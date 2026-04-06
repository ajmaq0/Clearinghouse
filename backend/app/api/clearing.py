from collections import defaultdict
from typing import Dict, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app import models, schemas, netting

router = APIRouter(prefix="/clearing", tags=["clearing"])


@router.post("/run", response_model=schemas.ClearingCycleDetailOut, status_code=201)
def run_clearing(db: Session = Depends(get_db)):
    confirmed_count = (
        db.query(models.Invoice)
        .filter(models.Invoice.status == "confirmed")
        .count()
    )
    if confirmed_count == 0:
        raise HTTPException(status_code=422, detail="No confirmed invoices to net")

    gross_cents, net_cents = netting.run_bilateral(db)

    cycle = (
        db.query(models.ClearingCycle)
        .order_by(models.ClearingCycle.completed_at.desc())
        .first()
    )
    return _build_detail(cycle)


@router.post("/run-optimal", response_model=schemas.ClearingCycleDetailOut, status_code=201)
def run_optimal_clearing_persist(db: Session = Depends(get_db)):
    """
    Run LP-optimal netting and persist all results.

    Creates a ClearingCycle with netting_type='optimal', ClearingResult rows
    per company pair, NetPosition rows per company, and marks invoices as cleared.
    """
    from app.netting_lp import run_optimal_persist
    confirmed_count = (
        db.query(models.Invoice)
        .filter(models.Invoice.status == "confirmed")
        .count()
    )
    if confirmed_count == 0:
        raise HTTPException(status_code=422, detail="No confirmed invoices to net")

    run_optimal_persist(db)

    cycle = (
        db.query(models.ClearingCycle)
        .order_by(models.ClearingCycle.completed_at.desc())
        .first()
    )
    return _build_detail(cycle)


@router.post("/multilateral", response_model=schemas.MultilateralNettingResult, status_code=200)
def run_multilateral_clearing(db: Session = Depends(get_db)):
    """
    Compute multilateral netting over all confirmed invoices.

    Returns gross obligations, bilateral-netted obligations, and
    multilateral-netted obligations (after cycle reduction via Johnson's
    algorithm).  Does not persist any state or change invoice statuses.
    """
    confirmed_count = (
        db.query(models.Invoice)
        .filter(models.Invoice.status == "confirmed")
        .count()
    )
    if confirmed_count == 0:
        raise HTTPException(status_code=422, detail="No confirmed invoices to net")

    gross, bilateral, multilateral = netting.run_multilateral(db)
    savings = bilateral - multilateral
    savings_vs_gross_bps = ((gross - multilateral) * 10_000 // gross) if gross > 0 else 0

    return schemas.MultilateralNettingResult(
        gross_cents=gross,
        bilateral_cents=bilateral,
        multilateral_cents=multilateral,
        savings_eur_cents=savings,
        savings_vs_gross_bps=savings_vs_gross_bps,
    )


@router.post("/optimal", response_model=schemas.OptimalNettingResult, status_code=200)
def run_optimal_clearing(db: Session = Depends(get_db)):
    """
    Compute LP-optimal netting and compare against bilateral + Johnson's.
    Returns all three results side by side for the comparison visualization.
    Does not persist state or change invoice statuses.
    """
    from app.netting_lp import run_optimal
    confirmed_count = (
        db.query(models.Invoice)
        .filter(models.Invoice.status == "confirmed")
        .count()
    )
    if confirmed_count == 0:
        raise HTTPException(status_code=422, detail="No confirmed invoices to net")

    return run_optimal(db)


@router.get("/company-comparison", response_model=schemas.CompanyComparisonOut)
def company_comparison(db: Session = Depends(get_db)):
    """
    Return per-company positions across three clearing scenarios:
    bilateral, Johnson's multilateral, and LP-optimal.

    Each row includes gross_payable, gross_receivable, bilateral_net,
    multilateral_net, optimal_net, savings_vs_bilateral_cents, and
    savings_vs_bilateral_pct.  Sorted by savings_vs_bilateral_cents
    descending (biggest savers first).  Read-only; no DB writes.
    """
    from app.netting_lp import run_optimal

    invoices = (
        db.query(models.Invoice)
        .filter(models.Invoice.status == "confirmed")
        .all()
    )
    if not invoices:
        raise HTTPException(status_code=422, detail="No confirmed invoices to net")

    # ── Gross directional flows ────────────────────────────────────────────
    gross_flow: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for inv in invoices:
        gross_flow[inv.from_company_id][inv.to_company_id] += inv.amount_cents

    all_ids = sorted(
        set(gross_flow.keys()) | {b for a_map in gross_flow.values() for b in a_map}
    )

    # Per-company gross payable / receivable
    gross_payable: Dict[str, int] = defaultdict(int)
    gross_receivable: Dict[str, int] = defaultdict(int)
    for a, targets in gross_flow.items():
        for b, amt in targets.items():
            gross_payable[a] += amt
            gross_receivable[b] += amt

    # ── Bilateral netting ──────────────────────────────────────────────────
    net_flow: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    visited: set = set()
    for a in all_ids:
        for b in all_ids:
            if a == b or (a, b) in visited or (b, a) in visited:
                continue
            visited.add((a, b))
            a_to_b = gross_flow[a][b]
            b_to_a = gross_flow[b][a]
            diff = a_to_b - b_to_a
            if diff > 0:
                net_flow[a][b] = diff
            elif diff < 0:
                net_flow[b][a] = -diff

    # Per-company bilateral net (positive = net payer, negative = net receiver)
    bilateral_net: Dict[str, int] = defaultdict(int)
    for a, targets in net_flow.items():
        for b, amt in targets.items():
            bilateral_net[a] += amt
            bilateral_net[b] -= amt

    # ── Multilateral netting (Johnson's cycle reduction) ───────────────────
    adj = {a: dict(b_map) for a, b_map in net_flow.items() if b_map}
    residual = netting._reduce_cycles(adj)

    multilateral_net: Dict[str, int] = defaultdict(int)
    for a, targets in residual.items():
        for b, amt in targets.items():
            multilateral_net[a] += amt
            multilateral_net[b] -= amt

    # ── LP-optimal netting ─────────────────────────────────────────────────
    lp = run_optimal(db)
    lp_status = lp["lp_status"]

    # Map cleared amounts by (from_id, to_id)
    cleared_map: Dict[tuple, int] = {}
    for edge in lp["cleared_edges"]:
        cleared_map[(edge["from_id"], edge["to_id"])] = edge["cleared_cents"]

    optimal_net: Dict[str, int] = defaultdict(int)
    for a, targets in gross_flow.items():
        for b, gross_amt in targets.items():
            cleared = cleared_map.get((a, b), 0)
            residual_amt = gross_amt - cleared
            optimal_net[a] += residual_amt
            optimal_net[b] -= residual_amt

    # ── Load company names ─────────────────────────────────────────────────
    companies = db.query(models.Company).filter(models.Company.id.in_(all_ids)).all()
    company_names = {c.id: c.name for c in companies}

    # ── Build rows ─────────────────────────────────────────────────────────
    rows = []
    for cid in all_ids:
        bil = bilateral_net[cid]
        opt = optimal_net[cid]
        savings = abs(bil) - abs(opt)
        savings_pct = round(savings / abs(bil) * 100, 1) if bil != 0 else 0.0
        rows.append(schemas.CompanyComparisonRow(
            company_id=cid,
            company_name=company_names.get(cid, cid),
            gross_payable=gross_payable[cid],
            gross_receivable=gross_receivable[cid],
            bilateral_net=bil,
            multilateral_net=multilateral_net[cid],
            optimal_net=opt,
            savings_vs_bilateral_cents=savings,
            savings_vs_bilateral_pct=savings_pct,
        ))

    rows.sort(key=lambda r: r.savings_vs_bilateral_cents, reverse=True)

    return schemas.CompanyComparisonOut(
        rows=rows,
        total_companies=len(rows),
        lp_status=lp_status,
    )


@router.get("/history", response_model=schemas.ClearingHistoryOut)
def clearing_history(db: Session = Depends(get_db)):
    """
    Return a time-series of all completed clearing cycles ordered most-recent first.

    Each entry aggregates from ClearingResult rows:
      gross_cents, net_cents, savings_pct, invoice_count, company_count.
    """
    cycles = (
        db.query(models.ClearingCycle)
        .filter(models.ClearingCycle.status == "completed")
        .order_by(models.ClearingCycle.completed_at.desc())
        .all()
    )
    entries = []
    for cycle in cycles:
        gross = sum(r.gross_amount_cents for r in cycle.results)
        net = sum(r.net_amount_cents for r in cycle.results)
        invoice_count = sum(r.invoices_count for r in cycle.results)
        companies = set()
        for r in cycle.results:
            companies.add(r.from_company_id)
            companies.add(r.to_company_id)
        savings_pct = round((gross - net) / gross * 100, 1) if gross > 0 else 0.0
        entries.append(schemas.ClearingHistoryEntry(
            id=cycle.id,
            completed_at=cycle.completed_at,
            netting_type=cycle.netting_type,
            gross_cents=gross,
            net_cents=net,
            savings_pct=savings_pct,
            invoice_count=invoice_count,
            company_count=len(companies),
        ))
    return schemas.ClearingHistoryOut(cycles=entries, total_cycles=len(entries))


@router.get("/cycles", response_model=List[schemas.ClearingCycleOut])
def list_cycles(db: Session = Depends(get_db)):
    return (
        db.query(models.ClearingCycle)
        .order_by(models.ClearingCycle.completed_at.desc())
        .all()
    )


@router.get("/cycles/{cycle_id}", response_model=schemas.ClearingCycleDetailOut)
def get_cycle(cycle_id: str, db: Session = Depends(get_db)):
    cycle = db.get(models.ClearingCycle, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    return _build_detail(cycle)


def _build_detail(cycle: models.ClearingCycle) -> schemas.ClearingCycleDetailOut:
    results = [schemas.ClearingResultOut.model_validate(r) for r in cycle.results]
    net_positions = [schemas.NetPositionOut.model_validate(p) for p in cycle.net_positions]

    total_gross = sum(r.gross_amount_cents for r in results)
    total_net = sum(r.net_amount_cents for r in results)
    total_invoices = sum(r.invoices_count for r in results)
    savings_bps = ((total_gross - total_net) * 10_000 // total_gross) if total_gross > 0 else 0

    return schemas.ClearingCycleDetailOut(
        cycle=schemas.ClearingCycleOut.model_validate(cycle),
        results=results,
        net_positions=net_positions,
        total_gross_cents=total_gross,
        total_net_cents=total_net,
        total_invoices=total_invoices,
        savings_bps=savings_bps,
    )

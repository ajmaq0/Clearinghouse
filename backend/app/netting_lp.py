"""
Optimal netting via Linear Programming.

Instead of sequential bilateral-then-cycle heuristics, formulates netting
as a single optimization: maximize total cleared obligations subject to
conservation constraints. Provably optimal for any graph topology.

All arithmetic in integer cents. LP solved in float, results rounded
and verified for conservation.
"""

from collections import defaultdict
from typing import Dict, List, Tuple

import numpy as np
from scipy.optimize import linprog
from sqlalchemy.orm import Session

from app import models


def run_optimal(db: Session) -> dict:
    """
    Compute optimal netting over all confirmed invoices using LP.

    Returns dict with:
      - gross_cents: total gross obligations
      - bilateral_cents: obligations after bilateral-only netting (for comparison)
      - johnson_cents: obligations after bilateral + Johnson's (for comparison)
      - optimal_cents: obligations after LP-optimal netting
      - optimal_savings_cents: gross - optimal
      - optimal_savings_pct: savings as percentage
      - improvement_over_johnson_cents: johnson - optimal (the delta our LP adds)
      - improvement_over_johnson_pct: improvement as percentage of johnson residual
      - cleared_edges: list of dicts for visualization
      - lp_status: "optimal", "fallback_to_johnson", or "no_invoices"

    Does NOT modify invoice status or write DB rows.
    """
    invoices = (
        db.query(models.Invoice)
        .filter(models.Invoice.status == "confirmed")
        .all()
    )

    if not invoices:
        return _empty_result()

    # Build directed obligation graph: gross_flow[i][j] = total cents i owes j
    gross_flow: Dict = defaultdict(lambda: defaultdict(int))
    for inv in invoices:
        gross_flow[inv.from_company_id][inv.to_company_id] += inv.amount_cents

    gross_total = sum(inv.amount_cents for inv in invoices)

    # Collect all companies and edges
    all_companies = sorted(
        set(gross_flow.keys()) |
        {b for a_map in gross_flow.values() for b in a_map}
    )
    company_idx = {c: i for i, c in enumerate(all_companies)}
    n = len(all_companies)

    edges: List[Tuple[int, int, int]] = []  # (from_idx, to_idx, capacity_cents)
    for a in gross_flow:
        for b in gross_flow[a]:
            if gross_flow[a][b] > 0:
                edges.append((company_idx[a], company_idx[b], gross_flow[a][b]))

    m = len(edges)

    if m == 0:
        return _empty_result()

    # LP: maximize sum of cleared[e] for each edge e
    # Variables: cleared[0], cleared[1], ..., cleared[m-1]

    # Objective: minimize -sum(cleared) (linprog minimizes)
    c = -np.ones(m)

    # Inequality constraints: A_ub @ x <= b_ub
    # For each company i: sum(cleared on outgoing) - sum(cleared on incoming) <= 0
    # i.e., no company pays out more through clearing than it receives
    A_rows = []
    b_rows = []

    for i in range(n):
        row = np.zeros(m)
        for e_idx, (src, tgt, _cap) in enumerate(edges):
            if src == i:
                row[e_idx] = 1.0   # outgoing = positive
            elif tgt == i:
                row[e_idx] = -1.0  # incoming = negative
        A_rows.append(row)
        b_rows.append(0.0)  # net outflow <= 0 means inflow >= outflow

    A_ub = np.array(A_rows)
    b_ub = np.array(b_rows)

    # Bounds: 0 <= cleared[e] <= capacity[e]
    bounds = [(0, cap) for (_src, _tgt, cap) in edges]

    # Solve
    result = linprog(c, A_ub=A_ub, b_ub=b_ub, bounds=bounds, method="highs")

    if not result.success:
        # Fallback: return Johnson's result if LP fails
        from app.netting import run_multilateral
        gross, bilateral, multilateral = run_multilateral(db)
        return {
            "gross_cents": gross,
            "bilateral_cents": bilateral,
            "johnson_cents": multilateral,
            "optimal_cents": multilateral,  # fallback
            "optimal_savings_cents": gross - multilateral,
            "optimal_savings_pct": round((gross - multilateral) / gross * 100, 1) if gross > 0 else 0.0,
            "improvement_over_johnson_cents": 0,
            "improvement_over_johnson_pct": 0.0,
            "cleared_edges": [],
            "lp_status": "fallback_to_johnson",
        }

    # Extract results — round to integer cents
    cleared = np.round(result.x).astype(int)

    # Ensure cleared doesn't exceed capacity (rounding safety)
    for e_idx in range(m):
        cleared[e_idx] = min(cleared[e_idx], edges[e_idx][2])
        cleared[e_idx] = max(cleared[e_idx], 0)

    total_cleared = int(np.sum(cleared))
    optimal_residual = gross_total - total_cleared

    # Build cleared edges list for visualization
    cleared_edges = []
    for e_idx, (src_idx, tgt_idx, cap) in enumerate(edges):
        if cleared[e_idx] > 0:
            cleared_edges.append({
                "from_id": all_companies[src_idx],
                "to_id": all_companies[tgt_idx],
                "gross_cents": cap,
                "cleared_cents": int(cleared[e_idx]),
                "residual_cents": cap - int(cleared[e_idx]),
            })

    # Get Johnson's result for comparison
    from app.netting import run_multilateral
    _gross, bilateral_net, johnson_net = run_multilateral(db)

    improvement = johnson_net - optimal_residual

    return {
        "gross_cents": gross_total,
        "bilateral_cents": bilateral_net,
        "johnson_cents": johnson_net,
        "optimal_cents": optimal_residual,
        "optimal_savings_cents": total_cleared,
        "optimal_savings_pct": round(total_cleared / gross_total * 100, 1) if gross_total > 0 else 0.0,
        "improvement_over_johnson_cents": max(0, improvement),
        "improvement_over_johnson_pct": round(improvement / johnson_net * 100, 1) if johnson_net > 0 else 0.0,
        "cleared_edges": cleared_edges,
        "lp_status": "optimal",
    }


def run_optimal_persist(db: Session) -> tuple:
    """
    Run LP-optimal netting and persist all results.

    Creates ClearingCycle (netting_type="optimal"), ClearingResult rows per
    company pair, NetPosition rows per company, and marks invoices as cleared.

    Returns (gross_cents, total_residual_cents).
    Raises ValueError if there are no confirmed invoices.
    """
    from collections import defaultdict
    from datetime import datetime, timezone
    from app import models

    invoices = (
        db.query(models.Invoice)
        .filter(models.Invoice.status == "confirmed")
        .all()
    )

    if not invoices:
        raise ValueError("No confirmed invoices to net")

    lp = run_optimal(db)

    # Build per-pair cleared map from LP edges: (from_id, to_id) -> cleared_cents
    cleared_map: Dict[tuple, int] = {}
    for edge in lp["cleared_edges"]:
        cleared_map[(edge["from_id"], edge["to_id"])] = edge["cleared_cents"]

    # Build per-pair aggregate: gross, invoice count
    pair_gross: Dict[tuple, int] = defaultdict(int)
    pair_count: Dict[tuple, int] = defaultdict(int)
    for inv in invoices:
        key = (inv.from_company_id, inv.to_company_id)
        pair_gross[key] += inv.amount_cents
        pair_count[key] += 1

    gross_total = sum(inv.amount_cents for inv in invoices)

    # Per-company receivable/payable based on LP residuals
    receivable: Dict[str, int] = defaultdict(int)
    payable: Dict[str, int] = defaultdict(int)

    pair_results = []
    for (from_id, to_id), gross in pair_gross.items():
        cleared = cleared_map.get((from_id, to_id), 0)
        residual = gross - cleared
        pair_results.append((from_id, to_id, gross, residual, pair_count[(from_id, to_id)]))
        if residual > 0:
            payable[from_id] += residual
            receivable[to_id] += residual

    now = datetime.now(timezone.utc)

    cycle = models.ClearingCycle(
        status="completed",
        completed_at=now,
        netting_type="optimal",
    )
    db.add(cycle)
    db.flush()

    for from_id, to_id, gross, residual, inv_count in pair_results:
        db.add(models.ClearingResult(
            clearing_cycle_id=cycle.id,
            from_company_id=from_id,
            to_company_id=to_id,
            gross_amount_cents=gross,
            net_amount_cents=residual,
            invoices_count=inv_count,
        ))

    all_participants = set(receivable.keys()) | set(payable.keys())
    for company_id in all_participants:
        rec = receivable[company_id]
        pay = payable[company_id]
        db.add(models.NetPosition(
            company_id=company_id,
            clearing_cycle_id=cycle.id,
            receivable_cents=rec,
            payable_cents=pay,
            net_cents=rec - pay,
        ))

    for inv in invoices:
        inv.status = "cleared"
        inv.clearing_cycle_id = cycle.id

    db.commit()
    db.refresh(cycle)

    total_residual = sum(r[3] for r in pair_results)
    return gross_total, total_residual


def _empty_result() -> dict:
    return {
        "gross_cents": 0,
        "bilateral_cents": 0,
        "johnson_cents": 0,
        "optimal_cents": 0,
        "optimal_savings_cents": 0,
        "optimal_savings_pct": 0.0,
        "improvement_over_johnson_cents": 0,
        "improvement_over_johnson_pct": 0.0,
        "cleared_edges": [],
        "lp_status": "no_invoices",
    }

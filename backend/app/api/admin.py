from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app import models, schemas

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/dashboard", response_model=schemas.AdminDashboardOut)
def admin_dashboard(db: Session = Depends(get_db)):
    total_companies = db.query(func.count(models.Company.id)).scalar()
    total_invoices = db.query(func.count(models.Invoice.id)).scalar()

    latest_cycle = (
        db.query(models.ClearingCycle)
        .order_by(models.ClearingCycle.completed_at.desc())
        .first()
    )

    total_gross = 0
    total_net = 0
    savings_bps = 0
    company_positions: List[schemas.CompanyNetSummary] = []

    if latest_cycle:
        total_gross = sum(r.gross_amount_cents for r in latest_cycle.results)
        total_net = sum(r.net_amount_cents for r in latest_cycle.results)
        savings_bps = ((total_gross - total_net) * 10_000 // total_gross) if total_gross > 0 else 0

        for pos in latest_cycle.net_positions:
            company = db.get(models.Company, pos.company_id)
            company_positions.append(schemas.CompanyNetSummary(
                company_id=pos.company_id,
                company_name=company.name if company else pos.company_id,
                receivable_cents=pos.receivable_cents,
                payable_cents=pos.payable_cents,
                net_cents=pos.net_cents,
            ))
        company_positions.sort(key=lambda x: x.net_cents, reverse=True)

    return schemas.AdminDashboardOut(
        latest_cycle=schemas.ClearingCycleOut.model_validate(latest_cycle) if latest_cycle else None,
        total_companies=total_companies,
        total_invoices=total_invoices,
        total_gross_cents=total_gross,
        total_net_cents=total_net,
        savings_bps=savings_bps,
        savings_percent=round(savings_bps / 100.0, 1),
        company_positions=company_positions,
    )


@router.get("/network", response_model=schemas.AdminNetworkOut)
def admin_network(db: Session = Depends(get_db)):
    companies = db.query(models.Company).all()

    # Build node volume from all invoices
    volume_by_company: dict[str, int] = {}
    for inv in db.query(models.Invoice).all():
        volume_by_company[inv.from_company_id] = volume_by_company.get(inv.from_company_id, 0) + inv.amount_cents
        volume_by_company[inv.to_company_id] = volume_by_company.get(inv.to_company_id, 0) + inv.amount_cents

    nodes = [
        schemas.NetworkNode(
            id=c.id,
            name=c.name,
            sector=c.sector,
            total_volume_cents=volume_by_company.get(c.id, 0),
        )
        for c in companies
    ]

    # Build edges from latest clearing cycle net results
    latest_cycle = (
        db.query(models.ClearingCycle)
        .order_by(models.ClearingCycle.completed_at.desc())
        .first()
    )

    edges: List[schemas.NetworkEdge] = []
    cycle_id = None

    if latest_cycle:
        cycle_id = latest_cycle.id
        for result in latest_cycle.results:
            if result.net_amount_cents > 0:
                edges.append(schemas.NetworkEdge(
                    source=result.from_company_id,
                    target=result.to_company_id,
                    weight=result.net_amount_cents,
                ))

    return schemas.AdminNetworkOut(nodes=nodes, edges=edges, cycle_id=cycle_id)

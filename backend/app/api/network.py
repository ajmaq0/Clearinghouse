from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app import models, schemas

router = APIRouter(prefix="/network", tags=["network"])


@router.get("/stats", response_model=schemas.NetworkStats)
def network_stats(db: Session = Depends(get_db)):
    total_companies = db.query(func.count(models.Company.id)).scalar()
    total_invoices = db.query(func.count(models.Invoice.id)).scalar()
    total_gross = db.query(
        func.coalesce(func.sum(models.Invoice.amount_cents), 0)
    ).scalar()

    # Latest cycle aggregate
    latest_cycle = (
        db.query(models.ClearingCycle)
        .order_by(models.ClearingCycle.completed_at.desc())
        .first()
    )

    total_net = 0
    savings_bps = 0
    last_cycle_at = None

    if latest_cycle:
        last_cycle_at = latest_cycle.completed_at
        gross_cycle = sum(r.gross_amount_cents for r in latest_cycle.results)
        net_cycle = sum(r.net_amount_cents for r in latest_cycle.results)
        total_net = net_cycle
        savings_bps = ((gross_cycle - net_cycle) * 10_000 // gross_cycle) if gross_cycle > 0 else 0

    return schemas.NetworkStats(
        total_companies=total_companies,
        total_invoices=total_invoices,
        total_gross_cents=total_gross,
        total_net_cents=total_net,
        savings_bps=savings_bps,
        savings_percent=savings_bps / 100.0,
        last_cycle_at=last_cycle_at,
    )


@router.get("/dashboard", response_model=schemas.AdminDashboardOut)
def network_dashboard(db: Session = Depends(get_db)):
    """Legacy dashboard endpoint — prefer GET /admin/dashboard."""
    from app.api.admin import admin_dashboard
    return admin_dashboard(db)

from typing import List
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

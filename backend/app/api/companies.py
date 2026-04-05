from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app import models, schemas

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("", response_model=List[schemas.CompanyOut])
def list_companies(db: Session = Depends(get_db)):
    return db.query(models.Company).order_by(models.Company.name).all()


@router.post("", response_model=schemas.CompanyOut, status_code=201)
def create_company(payload: schemas.CompanyCreate, db: Session = Depends(get_db)):
    company = models.Company(**payload.model_dump())
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.get("/{company_id}", response_model=schemas.CompanyOut)
def get_company(company_id: str, db: Session = Depends(get_db)):
    company = db.get(models.Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.get("/{company_id}/net-position", response_model=schemas.CompanyPositionOut)
@router.get("/{company_id}/position", response_model=schemas.CompanyPositionOut)
def get_company_position(company_id: str, db: Session = Depends(get_db)):
    company = db.get(models.Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    total_sent = db.query(func.coalesce(func.sum(models.Invoice.amount_cents), 0)).filter(
        models.Invoice.from_company_id == company_id,
        models.Invoice.status.in_(["confirmed", "cleared"]),
    ).scalar()

    total_received = db.query(func.coalesce(func.sum(models.Invoice.amount_cents), 0)).filter(
        models.Invoice.to_company_id == company_id,
        models.Invoice.status.in_(["confirmed", "cleared"]),
    ).scalar()

    latest_pos = (
        db.query(models.NetPosition)
        .filter(models.NetPosition.company_id == company_id)
        .join(models.ClearingCycle)
        .order_by(models.ClearingCycle.completed_at.desc())
        .first()
    )

    return schemas.CompanyPositionOut(
        company_id=company_id,
        company_name=company.name,
        latest_cycle_id=latest_pos.clearing_cycle_id if latest_pos else None,
        receivable_cents=latest_pos.receivable_cents if latest_pos else 0,
        payable_cents=latest_pos.payable_cents if latest_pos else 0,
        net_cents=latest_pos.net_cents if latest_pos else 0,
        total_sent_cents=total_sent,
        total_received_cents=total_received,
    )

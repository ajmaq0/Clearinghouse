from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app import models, schemas

router = APIRouter(prefix="/invoices", tags=["invoices"])


@router.get("", response_model=List[schemas.InvoiceOut])
def list_invoices(
    status: Optional[str] = Query(None),
    from_company_id: Optional[str] = Query(None),
    to_company_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.Invoice)
    if status:
        q = q.filter(models.Invoice.status == status)
    if from_company_id:
        q = q.filter(models.Invoice.from_company_id == from_company_id)
    if to_company_id:
        q = q.filter(models.Invoice.to_company_id == to_company_id)
    return q.order_by(models.Invoice.created_at.desc()).all()


@router.post("", response_model=schemas.InvoiceOut, status_code=201)
def submit_invoice(payload: schemas.InvoiceCreate, db: Session = Depends(get_db)):
    if not db.get(models.Company, payload.from_company_id):
        raise HTTPException(status_code=404, detail="from_company not found")
    if not db.get(models.Company, payload.to_company_id):
        raise HTTPException(status_code=404, detail="to_company not found")
    if payload.from_company_id == payload.to_company_id:
        raise HTTPException(status_code=400, detail="from_company and to_company must differ")

    data = payload.model_dump(exclude={"line_items"})
    invoice = models.Invoice(**data)
    db.add(invoice)
    db.flush()

    for li in (payload.line_items or []):
        db.add(models.InvoiceLineItem(invoice_id=invoice.id, **li.model_dump()))

    db.commit()
    db.refresh(invoice)
    return invoice


@router.get("/{invoice_id}", response_model=schemas.InvoiceOut)
def get_invoice(invoice_id: str, db: Session = Depends(get_db)):
    invoice = db.get(models.Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.patch("/{invoice_id}/confirm", response_model=schemas.InvoiceOut)
def confirm_invoice(invoice_id: str, db: Session = Depends(get_db)):
    invoice = db.get(models.Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status != "pending":
        raise HTTPException(status_code=400, detail=f"Invoice status is '{invoice.status}', must be 'pending' to confirm")
    invoice.status = "confirmed"
    db.commit()
    db.refresh(invoice)
    return invoice

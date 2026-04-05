#!/usr/bin/env python3
"""
Seed the ClearFlow database from seeds/seed_data.json and seeds/invoices.json.
Run inside the backend container:  python seeds/seed.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.core.database import engine, Base
from app import models

SEEDS_DIR = Path(__file__).parent


def load_json(name: str) -> dict:
    with open(SEEDS_DIR / name) as f:
        return json.load(f)


def seed(db: Session):
    if db.query(models.Company).count() > 0:
        print("Database already seeded — skipping.")
        return

    seed_data = load_json("seed_data.json")
    invoices_data = load_json("invoices.json")

    for c in seed_data["companies"]:
        db.add(models.Company(
            id=c["id"],
            name=c["name"],
            sector=c.get("sector"),
            city=c.get("city", "Hamburg"),
        ))
    db.flush()
    print(f"  Inserted {len(seed_data['companies'])} companies.")

    for inv in invoices_data["invoices"]:
        invoice = models.Invoice(
            from_company_id=inv["from_company_id"],
            to_company_id=inv["to_company_id"],
            amount_cents=inv["amount_cents"],
            description=inv.get("description"),
            due_date=inv.get("due_date"),
            status="confirmed",
        )
        db.add(invoice)
        db.flush()
        for li in inv.get("line_items", []):
            db.add(models.InvoiceLineItem(
                invoice_id=invoice.id,
                description=li["description"],
                amount_cents=li["amount_cents"],
                quantity=li.get("quantity", 1),
            ))
    db.flush()
    print(f"  Inserted {len(invoices_data['invoices'])} invoices.")

    db.commit()
    print("Seed complete.")


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    with Session(engine) as db:
        seed(db)

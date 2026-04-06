#!/usr/bin/env python3
"""
Seed the ClearFlow database from seeds/seed_data.json and seeds/invoices.json.
Run inside the backend container:  python seeds/seed.py
"""
import json
import random
import sys
from collections import defaultdict
from datetime import datetime, timezone, date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.core.database import engine, Base
from app import models

SEEDS_DIR = Path(__file__).parent

# Reproducible random seed for monthly history generation
_RNG = random.Random(42)

_DESCRIPTIONS = [
    "Frachtabwicklung", "Lagerdienstleistungen", "Beratungshonorar",
    "Transportkosten", "Verpackungsmaterial", "Logistikpauschale",
    "Handlinggebühr", "Zollabwicklung", "Wartungsvertrag", "IT-Dienstleistungen",
]

_LINE_ITEM_DESCS = [
    "Versicherungsprämie", "Lagerhaltungsgebühr", "Handling Fee",
    "Transportzuschlag", "Bearbeitungsgebühr",
]

# Monthly cycles: (year, month, day-of-completion)
_HISTORY_MONTHS = [
    (2026, 1, 31),
    (2026, 2, 28),
    (2026, 3, 31),
    (2026, 4, 5),   # April — run mid-month to feel live
    (2026, 5, 31),
    (2026, 6, 30),
]


def load_json(name: str) -> dict:
    with open(SEEDS_DIR / name) as f:
        return json.load(f)


def _run_bilateral_at(db: Session, invoices: list, completed_at: datetime) -> None:
    """
    Execute bilateral clearing on the given Invoice ORM objects and persist
    a ClearingCycle with completed_at set to the supplied timestamp.
    """
    if not invoices:
        return

    flows = defaultdict(lambda: defaultdict(lambda: [0, 0]))
    for inv in invoices:
        flows[inv.from_company_id][inv.to_company_id][0] += inv.amount_cents
        flows[inv.from_company_id][inv.to_company_id][1] += 1

    all_companies = set(flows.keys()) | {b for a_map in flows.values() for b in a_map}
    pair_results = []
    visited_pairs: set = set()

    for a in all_companies:
        for b in all_companies:
            if a >= b or (a, b) in visited_pairs:
                continue
            visited_pairs.add((a, b))
            a_to_b_cents, a_to_b_count = flows[a][b]
            b_to_a_cents, b_to_a_count = flows[b][a]
            gross_pair = a_to_b_cents + b_to_a_cents
            inv_count = a_to_b_count + b_to_a_count
            if gross_pair == 0:
                continue
            net = a_to_b_cents - b_to_a_cents
            if net > 0:
                payer, payee, net_cents = a, b, net
            elif net < 0:
                payer, payee, net_cents = b, a, -net
            else:
                payer, payee, net_cents = a, b, 0
            pair_results.append((payer, payee, gross_pair, net_cents, inv_count))

    receivable: dict = defaultdict(int)
    payable: dict = defaultdict(int)
    for payer, payee, _gross, net_cents, _ in pair_results:
        if net_cents > 0:
            payable[payer] += net_cents
            receivable[payee] += net_cents

    cycle = models.ClearingCycle(
        status="completed",
        started_at=completed_at,
        completed_at=completed_at,
        netting_type="bilateral",
    )
    db.add(cycle)
    db.flush()

    for payer, payee, gross_pair, net_cents, inv_count in pair_results:
        db.add(models.ClearingResult(
            clearing_cycle_id=cycle.id,
            from_company_id=payer,
            to_company_id=payee,
            gross_amount_cents=gross_pair,
            net_amount_cents=net_cents,
            invoices_count=inv_count,
        ))

    for company_id in set(receivable.keys()) | set(payable.keys()):
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

    db.flush()


def seed_history(db: Session, company_ids: list) -> None:
    """
    Generate 6 monthly batches of invoices (Jan–Jun 2026) and run bilateral
    clearing on each so the demo starts with a populated history timeline.
    """
    if db.query(models.ClearingCycle).count() > 0:
        print("  Clearing history already present — skipping history seed.")
        return

    n_companies = len(company_ids)
    total_invoices = 0

    for year, month, day in _HISTORY_MONTHS:
        n_invoices = _RNG.randint(18, 28)
        batch = []

        for _ in range(n_invoices):
            from_idx = _RNG.randrange(n_companies)
            to_idx = _RNG.randrange(n_companies - 1)
            if to_idx >= from_idx:
                to_idx += 1
            from_id = company_ids[from_idx]
            to_id = company_ids[to_idx]

            amount = _RNG.randint(200_000, 12_000_000)  # €2k–€120k
            due = date(year, month, day)
            desc = _RNG.choice(_DESCRIPTIONS)

            inv = models.Invoice(
                from_company_id=from_id,
                to_company_id=to_id,
                amount_cents=amount,
                description=desc,
                due_date=due,
                status="confirmed",
            )
            db.add(inv)
            db.flush()

            n_items = _RNG.randint(1, 3)
            remainder = amount
            for i in range(n_items):
                li_amt = (remainder if i == n_items - 1
                          else _RNG.randint(amount // (n_items * 2), amount // n_items))
                remainder -= li_amt
                db.add(models.InvoiceLineItem(
                    invoice_id=inv.id,
                    description=_RNG.choice(_LINE_ITEM_DESCS),
                    amount_cents=li_amt,
                    quantity=1,
                ))
            batch.append(inv)

        completed_at = datetime(year, month, day, 18, 0, 0, tzinfo=timezone.utc)
        _run_bilateral_at(db, batch, completed_at)
        total_invoices += len(batch)
        print(f"  Month {year}-{month:02d}: {len(batch)} invoices cleared.")

    db.commit()
    print(f"  History seed complete — {len(_HISTORY_MONTHS)} cycles, {total_invoices} invoices.")


def seed(db: Session):
    if db.query(models.Company).count() > 0:
        print("Database already seeded — skipping.")
        return

    seed_data = load_json("seed_data.json")
    invoices_data = load_json("invoices.json")

    for c in seed_data["companies"]:
        attrs = c.get("attributes", {})
        db.add(models.Company(
            id=c["id"],
            name=c["name"],
            sector=c.get("sector"),
            city=c.get("city", "Hamburg"),
            gls_member=attrs.get("gls_member", False),
            district=attrs.get("district"),
            subtype=attrs.get("subtype"),
            size=attrs.get("size"),
            founded=attrs.get("founded"),
        ))
    db.flush()
    print(f"  Inserted {len(seed_data['companies'])} companies.")

    company_ids = [c["id"] for c in seed_data["companies"]]
    seed_history(db, company_ids)

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
    print(f"  Inserted {len(invoices_data['invoices'])} confirmed invoices for demo.")

    db.commit()
    print("Seed complete.")


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    with Session(engine) as db:
        seed(db)

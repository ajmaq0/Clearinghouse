"""
Bilateral netting engine.

For each unordered pair (A, B):
  flow_A_to_B = sum of confirmed invoices where from=A, to=B
  flow_B_to_A = sum of confirmed invoices where from=B, to=A
  gross       = flow_A_to_B + flow_B_to_A
  net         = |flow_A_to_B - flow_B_to_A|

  If flow_A_to_B > flow_B_to_A: A still owes B (flow_A_to_B - flow_B_to_A) cents.
  If flow_B_to_A > flow_A_to_B: B still owes A (flow_B_to_A - flow_A_to_B) cents.
  If equal: fully offset.

One ClearingResult row is created per pair that has any invoices.
One NetPosition row is created per company that appears in any invoice.

All arithmetic is integer (EUR cents). No floating point anywhere.
"""

from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Tuple
from sqlalchemy.orm import Session
from app import models


def run_bilateral(db: Session) -> Tuple[int, int]:
    """
    Execute a bilateral clearing cycle over all 'confirmed' invoices.

    Returns (gross_cents, net_cents).
    Marks cleared invoices as 'cleared' and sets their clearing_cycle_id.
    Creates ClearingCycle, ClearingResult (per pair), and NetPosition (per company) rows.
    """
    invoices = (
        db.query(models.Invoice)
        .filter(models.Invoice.status == "confirmed")
        .all()
    )

    if not invoices:
        return 0, 0

    # Build per-pair flow maps
    # flows[a][b] = (total_cents, invoice_count) for invoices from A to B
    flows: Dict[str, Dict[str, List]] = defaultdict(lambda: defaultdict(lambda: [0, 0]))
    for inv in invoices:
        flows[inv.from_company_id][inv.to_company_id][0] += inv.amount_cents
        flows[inv.from_company_id][inv.to_company_id][1] += 1

    gross_total = sum(inv.amount_cents for inv in invoices)

    # Compute per-pair net obligations
    # pair_result: (payer_id, payee_id, gross_cents, net_cents, invoices_count)
    pair_results = []
    visited_pairs = set()
    all_companies = set(flows.keys()) | {b for a_map in flows.values() for b in a_map}
    net_total = 0

    for a in all_companies:
        for b in all_companies:
            if a >= b:
                continue
            if (a, b) in visited_pairs:
                continue
            visited_pairs.add((a, b))

            a_to_b_cents, a_to_b_count = flows[a][b]
            b_to_a_cents, b_to_a_count = flows[b][a]

            gross_pair = a_to_b_cents + b_to_a_cents
            invoices_count = a_to_b_count + b_to_a_count

            if gross_pair == 0:
                continue

            net = a_to_b_cents - b_to_a_cents
            if net > 0:
                payer, payee, net_cents = a, b, net
            elif net < 0:
                payer, payee, net_cents = b, a, -net
            else:
                payer, payee, net_cents = a, b, 0

            net_total += net_cents
            pair_results.append((payer, payee, gross_pair, net_cents, invoices_count))

    # Per-company receivable / payable accumulators
    receivable: Dict[str, int] = defaultdict(int)
    payable: Dict[str, int] = defaultdict(int)
    for payer, payee, gross_pair, net_cents, _ in pair_results:
        if net_cents > 0:
            payable[payer] += net_cents
            receivable[payee] += net_cents

    now = datetime.now(timezone.utc)

    # Create the clearing cycle
    cycle = models.ClearingCycle(status="completed", completed_at=now)
    db.add(cycle)
    db.flush()

    # Per-pair ClearingResult rows
    for payer, payee, gross_pair, net_cents, inv_count in pair_results:
        db.add(models.ClearingResult(
            clearing_cycle_id=cycle.id,
            from_company_id=payer,
            to_company_id=payee,
            gross_amount_cents=gross_pair,
            net_amount_cents=net_cents,
            invoices_count=inv_count,
        ))

    # Per-company NetPosition rows
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

    # Mark all included invoices as cleared and link to this cycle
    for inv in invoices:
        inv.status = "cleared"
        inv.clearing_cycle_id = cycle.id

    db.commit()
    db.refresh(cycle)

    return gross_total, net_total

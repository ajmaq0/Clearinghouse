"""
Bilateral and multilateral netting engine.

Bilateral — for each unordered pair (A, B):
  flow_A_to_B = sum of confirmed invoices where from=A, to=B
  flow_B_to_A = sum of confirmed invoices where from=B, to=A
  gross       = flow_A_to_B + flow_B_to_A
  net         = |flow_A_to_B - flow_B_to_A|

Multilateral — after bilateral netting, find and reduce cycles in the
remaining directed net-obligation graph using Johnson's algorithm (1975).
Each cycle is reduced by the minimum edge weight in that circuit.

All arithmetic is integer (EUR cents). No floating point anywhere.
"""

from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Tuple
from sqlalchemy.orm import Session
from app import models


# ---------------------------------------------------------------------------
# Johnson's algorithm — elementary circuit enumeration
# ---------------------------------------------------------------------------

def _johnson_cycles(adj: Dict[str, Dict[str, int]]) -> List[List[str]]:
    """
    Find all simple (elementary) cycles in a directed weighted graph.

    adj: {node: {neighbor: weight, ...}, ...}  — only positive-weight edges.
    Returns a list of cycles; each cycle is an ordered list of node IDs
    representing the path (the first node is implicitly repeated at the end).

    Johnson, D. B. (1975). Finding all the elementary circuits of a directed
    graph. SIAM Journal on Computing, 4(1), 77-84.
    """
    all_nodes: List[str] = sorted(
        set(adj.keys()) | {v for nbrs in adj.values() for v in nbrs}
    )
    idx: Dict[str, int] = {n: i for i, n in enumerate(all_nodes)}

    blocked: set = set()
    B: Dict[str, set] = defaultdict(set)
    stack: List[str] = []
    cycles: List[List[str]] = []

    def _unblock(u: str) -> None:
        blocked.discard(u)
        for w in list(B[u]):
            B[u].discard(w)
            if w in blocked:
                _unblock(w)

    def _circuit(v: str, start: str, s_idx: int) -> bool:
        found = False
        stack.append(v)
        blocked.add(v)
        for w in adj.get(v, {}):
            if idx.get(w, -1) < s_idx:
                continue  # restrict to subgraph with index >= s_idx
            if w == start:
                cycles.append(list(stack))
                found = True
            elif w not in blocked:
                if _circuit(w, start, s_idx):
                    found = True
        if found:
            _unblock(v)
        else:
            for w in adj.get(v, {}):
                if idx.get(w, -1) >= s_idx:
                    B[w].add(v)
        stack.pop()
        return found

    for i, s in enumerate(all_nodes):
        blocked.clear()
        B.clear()
        _circuit(s, s, i)

    return cycles


def _reduce_cycles(adj: Dict[str, Dict[str, int]]) -> Dict[str, Dict[str, int]]:
    """
    Iteratively find cycles and reduce each by the minimum edge weight until
    no more cycles remain.  Modifies and returns a copy of adj.
    """
    # Work on a mutable copy
    graph: Dict[str, Dict[str, int]] = {a: dict(b) for a, b in adj.items()}

    for _ in range(10_000):  # safety cap
        cycles = _johnson_cycles(graph)
        if not cycles:
            break

        improved = False
        for cycle in cycles:
            n = len(cycle)
            min_w = min(
                graph.get(cycle[i], {}).get(cycle[(i + 1) % n], 0)
                for i in range(n)
            )
            if min_w <= 0:
                continue
            improved = True
            for i in range(n):
                u, v = cycle[i], cycle[(i + 1) % n]
                graph[u][v] -= min_w
                if graph[u][v] == 0:
                    del graph[u][v]
                    if not graph[u]:
                        del graph[u]
        if not improved:
            break

    return graph


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


# ---------------------------------------------------------------------------
# Multilateral netting — pure computation, no DB writes
# ---------------------------------------------------------------------------

def run_multilateral(db: Session) -> Tuple[int, int, int]:
    """
    Compute multilateral netting over all 'confirmed' invoices.

    Steps:
      1. Gross obligations — sum of all confirmed invoice amounts.
      2. Bilateral netting — net opposing flows for each company pair.
      3. Multilateral netting — reduce cycles in the bilateral residual graph
         using Johnson's algorithm; each cycle is reduced by its minimum edge.

    Returns (gross_cents, bilateral_net_cents, multilateral_net_cents).
    Does NOT modify invoice status or write any rows to the database.
    """
    invoices = (
        db.query(models.Invoice)
        .filter(models.Invoice.status == "confirmed")
        .all()
    )

    if not invoices:
        return 0, 0, 0

    gross_total = sum(inv.amount_cents for inv in invoices)

    # Build raw directional flows
    raw: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for inv in invoices:
        raw[inv.from_company_id][inv.to_company_id] += inv.amount_cents

    all_companies = set(raw.keys()) | {b for a_map in raw.values() for b in a_map}

    # Bilateral netting: collapse opposing flows into a single net direction
    net_flow: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    visited_pairs: set = set()
    for a in all_companies:
        for b in all_companies:
            if a == b or (a, b) in visited_pairs or (b, a) in visited_pairs:
                continue
            visited_pairs.add((a, b))
            a_to_b = raw[a][b]
            b_to_a = raw[b][a]
            diff = a_to_b - b_to_a
            if diff > 0:
                net_flow[a][b] = diff
            elif diff < 0:
                net_flow[b][a] = -diff

    bilateral_net = sum(v for row in net_flow.values() for v in row.values())

    # Multilateral netting: reduce cycles in the residual graph
    adj: Dict[str, Dict[str, int]] = {
        a: dict(b_map) for a, b_map in net_flow.items() if b_map
    }
    residual = _reduce_cycles(adj)
    multilateral_net = sum(v for row in residual.values() for v in row.values())

    return gross_total, bilateral_net, multilateral_net

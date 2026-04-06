import json
from collections import defaultdict
from pathlib import Path
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app import models, schemas

# Load candidate companies once at import time.
# File lives at data/candidate_companies.json relative to the project root.
# We walk up from this file to find it.
_CANDIDATES_PATH = Path(__file__).parent.parent.parent.parent / "data" / "candidate_companies.json"

def _load_candidates() -> dict:
    """Return dict keyed by candidate id."""
    if not _CANDIDATES_PATH.exists():
        return {}
    with open(_CANDIDATES_PATH) as f:
        raw = json.load(f)
    return {c["id"]: c for c in raw.get("candidates", [])}

_CANDIDATES: dict = _load_candidates()

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


# Map raw sector values → cluster label (3 clusters)
SECTOR_TO_CLUSTER = {
    "port_logistics":   "Port & Logistik",
    "food_beverage":    "Lebensmittel & Gastronomie",
    "renewable_energy": "Erneuerbare Energien",
}
FALLBACK_CLUSTERS = ["Port & Logistik", "Lebensmittel & Gastronomie", "Erneuerbare Energien"]


def _sector_cluster(sector: str) -> str:
    return SECTOR_TO_CLUSTER.get((sector or "").lower(), FALLBACK_CLUSTERS[0])


def _find_components(node_ids: list, edges: list) -> dict:
    """Union-Find connected components. Returns {node_id: component_id}."""
    parent = {n: n for n in node_ids}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    for src, tgt in edges:
        if src in parent and tgt in parent:
            union(src, tgt)

    roots = {}
    comp_id = 0
    result = {}
    for n in node_ids:
        r = find(n)
        if r not in roots:
            roots[r] = comp_id
            comp_id += 1
        result[n] = roots[r]
    return result


@router.get("/topology", response_model=schemas.TopologyOut)
def network_topology(db: Session = Depends(get_db)):
    """Return graph topology with cluster assignments, connected components, and inter-cluster gaps."""
    companies = db.query(models.Company).all()
    invoices = db.query(models.Invoice).all()

    # Aggregate invoice amounts per (from, to) pair
    edge_map: dict = defaultdict(int)
    for inv in invoices:
        key = (inv.from_company_id, inv.to_company_id)
        edge_map[key] += inv.amount_cents

    # Per-company total volume (sent + received)
    volume_map: dict = defaultdict(int)
    for (src, tgt), amt in edge_map.items():
        volume_map[src] += amt
        volume_map[tgt] += amt

    # Latest net positions
    latest_cycle = (
        db.query(models.ClearingCycle)
        .order_by(models.ClearingCycle.completed_at.desc())
        .first()
    )
    net_pos_map: dict = {}
    if latest_cycle:
        for pos in latest_cycle.net_positions:
            net_pos_map[pos.company_id] = pos.net_cents

    node_ids = [c.id for c in companies]
    edge_pairs = list(edge_map.keys())
    comp_map = _find_components(node_ids, edge_pairs)

    nodes = []
    for c in companies:
        cluster = _sector_cluster(c.sector or "")
        nodes.append(schemas.TopologyNode(
            id=c.id,
            name=c.name,
            sector=c.sector or "Sonstiges",
            cluster=cluster,
            total_invoice_volume_cents=volume_map.get(c.id, 0),
            net_position_cents=net_pos_map.get(c.id, 0),
            component_id=comp_map.get(c.id, 0),
            gls_member=c.gls_member,
            district=c.district,
            subtype=c.subtype,
            size=c.size,
            founded=c.founded,
        ))

    edges = [
        schemas.TopologyEdge(source=src, target=tgt, total_amount_cents=amt)
        for (src, tgt), amt in edge_map.items()
    ]

    # Find cluster pairs that share no edge
    cluster_by_id = {c.id: _sector_cluster(c.sector or "") for c in companies}
    connected_cluster_pairs: set = set()
    for src, tgt in edge_map.keys():
        ca = cluster_by_id.get(src, "")
        cb = cluster_by_id.get(tgt, "")
        if ca and cb and ca != cb:
            connected_cluster_pairs.add(frozenset([ca, cb]))

    all_clusters = sorted(set(cluster_by_id.values()))
    gaps = []
    for i in range(len(all_clusters)):
        for j in range(i + 1, len(all_clusters)):
            pair = frozenset([all_clusters[i], all_clusters[j]])
            if pair not in connected_cluster_pairs:
                gaps.append(schemas.ClusterGap(cluster_a=all_clusters[i], cluster_b=all_clusters[j]))

    return schemas.TopologyOut(
        nodes=nodes,
        edges=edges,
        gaps=gaps,
        clusters=all_clusters,
    )


def _lp_savings_pct(gross_flow: dict) -> tuple:
    """
    Run LP-optimal netting in-memory on a gross_flow dict.

    gross_flow: {from_id: {to_id: amount_cents}}

    Returns (gross_cents, optimal_savings_pct).
    Does NOT touch the database.
    """
    import numpy as np
    from scipy.optimize import linprog

    all_companies = sorted(
        set(gross_flow.keys()) | {b for a_map in gross_flow.values() for b in a_map}
    )
    if not all_companies:
        return 0, 0.0

    company_idx = {c: i for i, c in enumerate(all_companies)}
    n = len(all_companies)

    edges = []
    for a in gross_flow:
        for b, cap in gross_flow[a].items():
            if cap > 0:
                edges.append((company_idx[a], company_idx[b], cap))

    if not edges:
        return 0, 0.0

    m = len(edges)
    gross_total = sum(e[2] for e in edges)

    c_obj = -np.ones(m)

    A_rows = []
    for i in range(n):
        row = np.zeros(m)
        for e_idx, (src, tgt, _cap) in enumerate(edges):
            if src == i:
                row[e_idx] = 1.0
            elif tgt == i:
                row[e_idx] = -1.0
        A_rows.append(row)

    A_ub = np.array(A_rows)
    b_ub = np.zeros(n)
    bounds = [(0, cap) for (_s, _t, cap) in edges]

    result = linprog(c_obj, A_ub=A_ub, b_ub=b_ub, bounds=bounds, method="highs")
    if not result.success:
        # Fallback: bilateral savings estimate (~33%)
        return gross_total, 33.0

    cleared = int(np.sum(np.round(result.x)))
    savings_pct = round(cleared / gross_total * 100, 1) if gross_total > 0 else 0.0
    return gross_total, savings_pct


def _count_new_cycles(base_flow: dict, extra_flow: dict) -> int:
    """
    Count how many additional directed cycles (length ≥ 3) become reachable
    when extra_flow edges are added to base_flow.  Uses simple DFS cycle detection.
    Only counts cycles that include at least one candidate node.
    """
    combined = defaultdict(set)
    for src, targets in base_flow.items():
        for tgt in targets:
            combined[src].add(tgt)
    candidate_nodes = set()
    for src, targets in extra_flow.items():
        for tgt in targets:
            combined[src].add(tgt)
            candidate_nodes.add(src)
            candidate_nodes.add(tgt)

    # For each candidate node, count simple cycles through it (capped at 20)
    cycles_found = 0
    for start in candidate_nodes:
        stack = [(start, [start], {start})]
        while stack and cycles_found < 20:
            node, path, visited = stack.pop()
            for nb in combined.get(node, []):
                if nb == start and len(path) >= 3:
                    cycles_found += 1
                elif nb not in visited and len(path) < 6:
                    stack.append((nb, path + [nb], visited | {nb}))
    return min(cycles_found, 20)


@router.post("/simulate-growth", response_model=schemas.GrowthSimulateResult)
def simulate_growth(
    req: schemas.GrowthSimulateRequest,
    db: Session = Depends(get_db),
):
    """
    Simulate adding candidate companies to the network.

    Temporarily injects their hypothetical invoice flows into the LP-optimal
    netting graph and returns current vs projected savings.  Does NOT modify
    any real invoice or company data.
    """
    if not _CANDIDATES:
        raise HTTPException(status_code=503, detail="Candidate data not loaded (data/candidate_companies.json missing)")

    unknown = [cid for cid in req.candidate_ids if cid not in _CANDIDATES]
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown candidate IDs: {unknown}")

    # Build current gross_flow from confirmed invoices in DB
    invoices = (
        db.query(models.Invoice)
        .filter(models.Invoice.status == "confirmed")
        .all()
    )

    base_flow: dict = defaultdict(lambda: defaultdict(int))
    for inv in invoices:
        base_flow[inv.from_company_id][inv.to_company_id] += inv.amount_cents

    # Current savings (pure real data)
    current_gross, current_savings_pct = _lp_savings_pct(base_flow)

    # Build extra flows from selected candidates
    extra_flow: dict = defaultdict(lambda: defaultdict(int))
    candidate_names = []
    for cid in req.candidate_ids:
        cand = _CANDIDATES[cid]
        candidate_names.append(cand["name"])
        for inv in cand.get("hypothetical_invoices", []):
            extra_flow[inv["from_id"]][inv["to_id"]] += inv["amount_cents"]

    # Projected: combine base + extra
    projected_flow: dict = defaultdict(lambda: defaultdict(int))
    for src, targets in base_flow.items():
        for tgt, amt in targets.items():
            projected_flow[src][tgt] += amt
    for src, targets in extra_flow.items():
        for tgt, amt in targets.items():
            projected_flow[src][tgt] += amt

    projected_gross, projected_savings_pct = _lp_savings_pct(projected_flow)

    current_cleared = int(current_gross * current_savings_pct / 100)
    projected_cleared = int(projected_gross * projected_savings_pct / 100)
    delta_savings_cents = projected_cleared - current_cleared

    # Count new invoice connections (edges) added by candidates
    new_connections = sum(len(targets) for targets in extra_flow.values())

    new_cycles = _count_new_cycles(base_flow, extra_flow)

    return schemas.GrowthSimulateResult(
        current_savings_pct=current_savings_pct,
        projected_savings_pct=projected_savings_pct,
        delta_savings_cents=max(0, delta_savings_cents),
        new_connections=new_connections,
        new_cycles_found=new_cycles,
        candidate_names=candidate_names,
    )


# ── Cascade helpers ───────────────────────────────────────────────────────────


def _longest_path(graph: dict, nodes: set) -> list:
    """Return longest simple path (list of node ids) in a directed graph restricted to `nodes`."""
    best: list = []

    def dfs(node: str, path: list, visited: set):
        nonlocal best
        if len(path) > len(best):
            best = list(path)
        for nb in graph.get(node, []):
            if nb in nodes and nb not in visited:
                visited.add(nb)
                path.append(nb)
                dfs(nb, path, visited)
                path.pop()
                visited.remove(nb)

    for start in nodes:
        dfs(start, [start], {start})

    return best


@router.get("/cascade-summary")
def cascade_summary(db: Session = Depends(get_db)):
    """
    Aggregate payment-cascade statistics.

    Returns:
      companies_with_timing_mismatch: int — companies that both owe and are owed money
      total_blocked_cents: int — total payables blocked by waiting for incoming payments
      worst_cascade_chain: list[str] — company names in the longest mismatch chain
      avg_days_blocked: float — average days amounts are estimated to be blocked
    """
    invoices = (
        db.query(models.Invoice)
        .filter(models.Invoice.status == "confirmed")
        .all()
    )

    outgoing: dict = defaultdict(int)   # company_id → total owed by this company
    incoming: dict = defaultdict(int)   # company_id → total owed to this company
    graph: dict = defaultdict(list)     # debtor → [creditor, ...]

    for inv in invoices:
        outgoing[inv.from_company_id] += inv.amount_cents
        incoming[inv.to_company_id]   += inv.amount_cents
        graph[inv.from_company_id].append(inv.to_company_id)

    # Companies with timing mismatch: owe money AND are waiting for incoming
    mismatch_ids = {
        cid for cid in set(outgoing) | set(incoming)
        if outgoing.get(cid, 0) > 0 and incoming.get(cid, 0) > 0
    }

    total_blocked = sum(
        min(outgoing.get(cid, 0), incoming.get(cid, 0))
        for cid in mismatch_ids
    )

    # Longest chain among mismatch companies
    chain_ids = _longest_path(graph, mismatch_ids)

    company_names = {}
    if chain_ids:
        companies = db.query(models.Company).filter(models.Company.id.in_(chain_ids)).all()
        company_names = {c.id: c.name for c in companies}

    worst_chain = [company_names.get(cid, cid) for cid in chain_ids]

    # Compute avg_days_blocked from actual due_date values.
    # For each mismatch company, find the gap between earliest outgoing
    # due_date and latest incoming due_date.
    avg_days_blocked = None
    if mismatch_ids:
        outgoing_invs = (
            db.query(models.Invoice)
            .filter(
                models.Invoice.from_company_id.in_(mismatch_ids),
                models.Invoice.status == "confirmed",
                models.Invoice.due_date.isnot(None),
            )
            .all()
        )
        incoming_invs = (
            db.query(models.Invoice)
            .filter(
                models.Invoice.to_company_id.in_(mismatch_ids),
                models.Invoice.status == "confirmed",
                models.Invoice.due_date.isnot(None),
            )
            .all()
        )

        # Group by company
        earliest_outgoing: dict = {}
        for inv in outgoing_invs:
            cid = inv.from_company_id
            if cid in mismatch_ids:
                if cid not in earliest_outgoing or inv.due_date < earliest_outgoing[cid]:
                    earliest_outgoing[cid] = inv.due_date

        latest_incoming: dict = {}
        for inv in incoming_invs:
            cid = inv.to_company_id
            if cid in mismatch_ids:
                if cid not in latest_incoming or inv.due_date > latest_incoming[cid]:
                    latest_incoming[cid] = inv.due_date

        gaps = []
        for cid in mismatch_ids:
            if cid in earliest_outgoing and cid in latest_incoming:
                gap = (latest_incoming[cid] - earliest_outgoing[cid]).days
                if gap > 0:
                    gaps.append(gap)

        if gaps:
            avg_days_blocked = round(sum(gaps) / len(gaps), 1)

    result = {
        "companies_with_timing_mismatch": len(mismatch_ids),
        "total_blocked_cents": total_blocked,
        "worst_cascade_chain": worst_chain,
    }
    if avg_days_blocked is not None:
        result["avg_days_blocked"] = avg_days_blocked

    return result


# ── Matching hints ────────────────────────────────────────────────────────────

# German/English stop-words to skip during keyword extraction
_STOP_WORDS = {
    "und", "oder", "für", "von", "der", "die", "das", "des", "dem", "den",
    "ein", "eine", "einer", "eines", "einem", "einen",
    "an", "auf", "in", "zu", "mit", "bei", "nach", "aus", "über", "unter",
    "the", "and", "for", "of", "a", "an", "to", "in", "at", "by", "from",
    "per", "je", "nr", "nr.", "st.", "stk", "stück",
}


def _keywords(text: str) -> set:
    """Extract lowercase alphabetic tokens (≥4 chars) from a description."""
    if not text:
        return set()
    tokens = set()
    for tok in text.lower().split():
        tok = tok.strip(".,;:()[]\"'")
        if len(tok) >= 4 and tok.isalpha() and tok not in _STOP_WORDS:
            tokens.add(tok)
    return tokens


def _similarity(kw_a: set, kw_b: set) -> float:
    """Jaccard similarity between two keyword sets."""
    if not kw_a or not kw_b:
        return 0.0
    return len(kw_a & kw_b) / len(kw_a | kw_b)


# ── Demo mock data ─────────────────────────────────────────────────────────────

_DEMO_HINTS = {
    "supplier_matches": [
        {
            "need_description": "Weizenmehl Type 550 (25 kg Säcke)",
            "supplier_name": "Norddeutsche Mühle GmbH",
            "supplier_id": "demo-supplier-1",
            "similarity": 0.82,
        },
        {
            "need_description": "Mehl und Getreideverarbeitung",
            "supplier_name": "HansaMühl AG",
            "supplier_id": "demo-supplier-2",
            "similarity": 0.74,
        },
        {
            "need_description": "Transportlogistik & Mehllieferung",
            "supplier_name": "Elbe Logistik KG",
            "supplier_id": "demo-supplier-3",
            "similarity": 0.61,
        },
    ],
    "buyer_matches": [
        {
            "supply_description": "Handwerkliche Backwaren und Brötchen",
            "buyer_name": "Kantine Hafen Hamburg GmbH",
            "buyer_id": "demo-buyer-1",
            "similarity": 0.77,
        },
        {
            "supply_description": "Brot und Gebäck — Tagesproduktion",
            "buyer_name": "HafenCafé Betrieb UG",
            "buyer_id": "demo-buyer-2",
            "similarity": 0.69,
        },
    ],
    "structural_opportunities": [
        {
            "description": "Gemeinsamer Mehlbezug mit 3 weiteren Bäckereien möglich",
            "estimated_volume_cents": 480000,
        },
        {
            "description": "Sammellieferung Transport → 4 Betriebe auf gleicher Route",
            "estimated_volume_cents": 210000,
        },
    ],
}


@router.get("/matching-hints")
def matching_hints(
    company_id: str,
    demo: bool = False,
    db: Session = Depends(get_db),
):
    """
    Return supplier matches, buyer matches, and structural opportunities for a company.

    Keyword-overlap matching on invoice line_item descriptions across all companies.
    Supports ?demo=true for a mock response (useful when DB has sparse data).
    """
    if demo:
        return _DEMO_HINTS

    company = db.get(models.Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Collect all invoices with their line items (confirmed + pending)
    all_invoices = (
        db.query(models.Invoice)
        .filter(models.Invoice.status.in_(["confirmed", "pending"]))
        .all()
    )

    # Build per-company outgoing and incoming description sets
    # outgoing[cid] = list of (description, amount_cents) for invoices sent BY that company
    # incoming[cid] = list of (description, amount_cents) for invoices received BY that company
    outgoing: dict = defaultdict(list)
    incoming: dict = defaultdict(list)

    for inv in all_invoices:
        descs = []
        if inv.line_items:
            for li in inv.line_items:
                if li.description:
                    descs.append((li.description, li.amount_cents or 0))
        elif inv.description:
            descs.append((inv.description, inv.amount_cents))

        for desc, amt in descs:
            outgoing[inv.from_company_id].append((desc, amt))
            incoming[inv.to_company_id].append((desc, amt))

    # Target company's needs = what it pays FOR (outgoing descriptions)
    # Target company's supply = what it sells (incoming descriptions from its payers' perspective)
    my_outgoing = outgoing.get(company_id, [])
    my_incoming = incoming.get(company_id, [])

    my_out_kw = {desc: _keywords(desc) for desc, _ in my_outgoing}
    my_in_kw = {desc: _keywords(desc) for desc, _ in my_incoming}

    # --- Supplier matches ---
    # Find other companies whose OUTGOING descriptions overlap with MY outgoing descriptions
    # (i.e., they supply something I also need)
    supplier_matches = []
    seen_suppliers: set = set()

    all_other_companies = set(outgoing.keys()) - {company_id}
    for other_cid in all_other_companies:
        best_desc = None
        best_sim = 0.0
        for other_desc, _ in outgoing[other_cid]:
            other_kw = _keywords(other_desc)
            for my_desc, my_kw in my_out_kw.items():
                sim = _similarity(my_kw, other_kw)
                if sim > best_sim:
                    best_sim = sim
                    best_desc = my_desc

        if best_sim >= 0.2 and other_cid not in seen_suppliers:
            seen_suppliers.add(other_cid)
            other_company = db.get(models.Company, other_cid)
            supplier_matches.append({
                "need_description": best_desc,
                "supplier_name": other_company.name if other_company else other_cid,
                "supplier_id": other_cid,
                "similarity": round(best_sim, 2),
            })

    supplier_matches.sort(key=lambda x: x["similarity"], reverse=True)

    # --- Buyer matches ---
    # Find companies whose INCOMING descriptions overlap with MY incoming descriptions
    # (i.e., they buy something I also sell)
    buyer_matches = []
    seen_buyers: set = set()

    all_other_receivers = set(incoming.keys()) - {company_id}
    for other_cid in all_other_receivers:
        best_desc = None
        best_sim = 0.0
        for other_desc, _ in incoming[other_cid]:
            other_kw = _keywords(other_desc)
            for my_desc, my_kw in my_in_kw.items():
                sim = _similarity(my_kw, other_kw)
                if sim > best_sim:
                    best_sim = sim
                    best_desc = my_desc

        if best_sim >= 0.2 and other_cid not in seen_buyers:
            seen_buyers.add(other_cid)
            other_company = db.get(models.Company, other_cid)
            buyer_matches.append({
                "supply_description": best_desc,
                "buyer_name": other_company.name if other_company else other_cid,
                "buyer_id": other_cid,
                "similarity": round(best_sim, 2),
            })

    buyer_matches.sort(key=lambda x: x["similarity"], reverse=True)

    # --- Structural opportunities ---
    # Find keyword clusters across all companies' descriptions; flag high-volume ones
    keyword_volumes: dict = defaultdict(int)
    keyword_companies: dict = defaultdict(set)

    for cid, descs in outgoing.items():
        for desc, amt in descs:
            for kw in _keywords(desc):
                keyword_volumes[kw] += amt
                keyword_companies[kw].add(cid)

    structural_opportunities = []
    for kw, vol in sorted(keyword_volumes.items(), key=lambda x: -x[1]):
        companies_involved = keyword_companies[kw]
        n = len(companies_involved)
        if n >= 2 and company_id in companies_involved and vol > 0:
            structural_opportunities.append({
                "description": f"Gemeinschaftspotenzial '{kw}': {n} Unternehmen, mögliche Bündelung",
                "estimated_volume_cents": vol,
            })
        if len(structural_opportunities) >= 5:
            break

    return {
        "supplier_matches": supplier_matches[:10],
        "buyer_matches": buyer_matches[:10],
        "structural_opportunities": structural_opportunities,
    }


@router.get("/cascade")
def company_cascade(company_id: str, db: Session = Depends(get_db)):
    """
    Payment-cascade analysis for a single company.

    Returns incoming and outgoing invoices, cascade risk score (0–1),
    blocked_amount_cents, and cascade_depth (hops in the cascade chain).
    """
    company = db.get(models.Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    outgoing_invs = (
        db.query(models.Invoice)
        .filter(models.Invoice.from_company_id == company_id,
                models.Invoice.status == "confirmed")
        .all()
    )
    incoming_invs = (
        db.query(models.Invoice)
        .filter(models.Invoice.to_company_id == company_id,
                models.Invoice.status == "confirmed")
        .all()
    )

    outgoing_total = sum(i.amount_cents for i in outgoing_invs)
    incoming_total = sum(i.amount_cents for i in incoming_invs)
    blocked = min(outgoing_total, incoming_total)
    cascade_risk = round(blocked / outgoing_total, 2) if outgoing_total > 0 else 0.0

    # Estimate depth: how many hops until there's a company with no incoming (chain root)
    depth = 0
    visited = {company_id}
    frontier = {inv.to_company_id for inv in outgoing_invs}
    while frontier and depth < 10:
        depth += 1
        next_frontier = set()
        for cid in frontier - visited:
            visited.add(cid)
            has_incoming = (
                db.query(models.Invoice)
                .filter(models.Invoice.to_company_id == cid,
                        models.Invoice.from_company_id.notin_(visited),
                        models.Invoice.status == "confirmed")
                .count()
            )
            if has_incoming:
                next_frontier.add(cid)
        frontier = next_frontier

    def _inv_shape(inv: models.Invoice, other_id: str, direction: str) -> dict:
        other = db.get(models.Company, other_id)
        return {
            "id": inv.id,
            "amount_cents": inv.amount_cents,
            "direction": direction,
            "other_company_id": other_id,
            "other_company_name": other.name if other else other_id,
        }

    return {
        "company_id": company_id,
        "company_name": company.name,
        "incoming_invoices": [_inv_shape(i, i.from_company_id, "incoming") for i in incoming_invs[:10]],
        "outgoing_invoices": [_inv_shape(i, i.to_company_id, "outgoing") for i in outgoing_invs[:10]],
        "cascade_risk": cascade_risk,
        "blocked_amount_cents": blocked,
        "cascade_depth": depth,
    }

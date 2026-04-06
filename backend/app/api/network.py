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

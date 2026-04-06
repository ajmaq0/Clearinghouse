from collections import defaultdict
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

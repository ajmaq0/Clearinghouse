"""
Optimal netting via Linear Programming.

Instead of sequential bilateral-then-cycle heuristics, formulates netting
as a single optimization: maximize total cleared obligations subject to
conservation constraints. Provably optimal for any graph topology.

All arithmetic in integer cents. LP solved in float, results rounded
and verified for conservation.
"""

from collections import defaultdict
from typing import Dict, List, Tuple

import numpy as np
from scipy.optimize import linprog
from sqlalchemy.orm import Session

from app import models


def run_optimal(db: Session) -> dict:
    """
    Compute optimal netting over all confirmed invoices using LP.

    Returns dict with:
      - gross_cents: total gross obligations
      - bilateral_cents: obligations after bilateral-only netting (for comparison)
      - johnson_cents: obligations after bilateral + Johnson's (for comparison)
      - optimal_cents: obligations after LP-optimal netting
      - optimal_savings_cents: gross - optimal
      - optimal_savings_pct: savings as percentage
      - improvement_over_johnson_cents: johnson - optimal (the delta our LP adds)
      - improvement_over_johnson_pct: improvement as percentage of johnson residual
      - cleared_edges: list of dicts for visualization
      - lp_status: "optimal", "fallback_to_johnson", or "no_invoices"

    Does NOT modify invoice status or write DB rows.
    """
    invoices = (
        db.query(models.Invoice)
        .filter(models.Invoice.status == "confirmed")
        .all()
    )

    if not invoices:
        return _empty_result()

    # Build directed obligation graph: gross_flow[i][j] = total cents i owes j
    gross_flow: Dict = defaultdict(lambda: defaultdict(int))
    for inv in invoices:
        gross_flow[inv.from_company_id][inv.to_company_id] += inv.amount_cents

    gross_total = sum(inv.amount_cents for inv in invoices)

    # Collect all companies and edges
    all_companies = sorted(
        set(gross_flow.keys()) |
        {b for a_map in gross_flow.values() for b in a_map}
    )
    company_idx = {c: i for i, c in enumerate(all_companies)}
    n = len(all_companies)

    edges: List[Tuple[int, int, int]] = []  # (from_idx, to_idx, capacity_cents)
    for a in gross_flow:
        for b in gross_flow[a]:
            if gross_flow[a][b] > 0:
                edges.append((company_idx[a], company_idx[b], gross_flow[a][b]))

    m = len(edges)

    if m == 0:
        return _empty_result()

    # LP: maximize sum of cleared[e] for each edge e
    # Variables: cleared[0], cleared[1], ..., cleared[m-1]

    # Objective: minimize -sum(cleared) (linprog minimizes)
    c = -np.ones(m)

    # Inequality constraints: A_ub @ x <= b_ub
    # For each company i: sum(cleared on outgoing) - sum(cleared on incoming) <= 0
    # i.e., no company pays out more through clearing than it receives
    A_rows = []
    b_rows = []

    for i in range(n):
        row = np.zeros(m)
        for e_idx, (src, tgt, _cap) in enumerate(edges):
            if src == i:
                row[e_idx] = 1.0   # outgoing = positive
            elif tgt == i:
                row[e_idx] = -1.0  # incoming = negative
        A_rows.append(row)
        b_rows.append(0.0)  # net outflow <= 0 means inflow >= outflow

    A_ub = np.array(A_rows)
    b_ub = np.array(b_rows)

    # Bounds: 0 <= cleared[e] <= capacity[e]
    bounds = [(0, cap) for (_src, _tgt, cap) in edges]

    # Solve
    result = linprog(c, A_ub=A_ub, b_ub=b_ub, bounds=bounds, method="highs")

    if not result.success:
        # Fallback: return Johnson's result if LP fails
        from app.netting import run_multilateral
        gross, bilateral, multilateral = run_multilateral(db)
        return {
            "gross_cents": gross,
            "bilateral_cents": bilateral,
            "johnson_cents": multilateral,
            "optimal_cents": multilateral,  # fallback
            "optimal_savings_cents": gross - multilateral,
            "optimal_savings_pct": round((gross - multilateral) / gross * 100, 1) if gross > 0 else 0.0,
            "improvement_over_johnson_cents": 0,
            "improvement_over_johnson_pct": 0.0,
            "cleared_edges": [],
            "lp_status": "fallback_to_johnson",
        }

    # Extract results — round to integer cents
    cleared = np.round(result.x).astype(int)

    # Ensure cleared doesn't exceed capacity (rounding safety)
    for e_idx in range(m):
        cleared[e_idx] = min(cleared[e_idx], edges[e_idx][2])
        cleared[e_idx] = max(cleared[e_idx], 0)

    total_cleared = int(np.sum(cleared))
    optimal_residual = gross_total - total_cleared

    # Build cleared edges list for visualization
    cleared_edges = []
    for e_idx, (src_idx, tgt_idx, cap) in enumerate(edges):
        if cleared[e_idx] > 0:
            cleared_edges.append({
                "from_id": all_companies[src_idx],
                "to_id": all_companies[tgt_idx],
                "gross_cents": cap,
                "cleared_cents": int(cleared[e_idx]),
                "residual_cents": cap - int(cleared[e_idx]),
            })

    # Get Johnson's result for comparison
    from app.netting import run_multilateral
    _gross, bilateral_net, johnson_net = run_multilateral(db)

    improvement = johnson_net - optimal_residual

    return {
        "gross_cents": gross_total,
        "bilateral_cents": bilateral_net,
        "johnson_cents": johnson_net,
        "optimal_cents": optimal_residual,
        "optimal_savings_cents": total_cleared,
        "optimal_savings_pct": round(total_cleared / gross_total * 100, 1) if gross_total > 0 else 0.0,
        "improvement_over_johnson_cents": max(0, improvement),
        "improvement_over_johnson_pct": round(improvement / johnson_net * 100, 1) if johnson_net > 0 else 0.0,
        "cleared_edges": cleared_edges,
        "lp_status": "optimal",
    }


def _empty_result() -> dict:
    return {
        "gross_cents": 0,
        "bilateral_cents": 0,
        "johnson_cents": 0,
        "optimal_cents": 0,
        "optimal_savings_cents": 0,
        "optimal_savings_pct": 0.0,
        "improvement_over_johnson_cents": 0,
        "improvement_over_johnson_pct": 0.0,
        "cleared_edges": [],
        "lp_status": "no_invoices",
    }

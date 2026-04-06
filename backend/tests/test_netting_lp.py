"""
POEA-34: LP netting correctness + edge case verification suite.

Tests run against the pure-logic layer (netting_lp.run_optimal) using a mock
DB session — no running Postgres or Docker required.

Run with:
    cd backend
    pip install pytest scipy numpy
    pytest tests/test_netting_lp.py -v
"""
import time
import types
from unittest.mock import MagicMock

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_invoice(from_id: str, to_id: str, amount_cents: int, status: str = "confirmed"):
    inv = MagicMock()
    inv.from_company_id = from_id
    inv.to_company_id = to_id
    inv.amount_cents = amount_cents
    inv.status = status
    return inv


def _make_db(invoices):
    """Return a mock SQLAlchemy Session whose confirmed-invoice query returns *invoices*."""
    db = MagicMock()
    # db.query(models.Invoice).filter(...).all() → invoices
    db.query.return_value.filter.return_value.all.return_value = invoices
    # db.query(models.Invoice).filter(...).count() → len(invoices)
    db.query.return_value.filter.return_value.count.return_value = len(invoices)
    return db


# ---------------------------------------------------------------------------
# Import under test (requires scipy + numpy installed)
# ---------------------------------------------------------------------------

from app.netting_lp import run_optimal  # noqa: E402


# ---------------------------------------------------------------------------
# 1. Empty / no invoices
# ---------------------------------------------------------------------------

def test_empty_invoices():
    db = _make_db([])
    result = run_optimal(db)
    assert result["lp_status"] == "no_invoices"
    assert result["gross_cents"] == 0
    assert result["optimal_cents"] == 0


# ---------------------------------------------------------------------------
# 2. Conservation: for every company, cleared inflow >= cleared outflow
# ---------------------------------------------------------------------------

def test_conservation():
    """
    Five-company ring: A->B->C->D->E->A each €1 000 000.
    LP should clear the full ring; every company has inflow == outflow == 1_000_000.
    """
    invoices = [
        _make_invoice("A", "B", 1_000_000),
        _make_invoice("B", "C", 1_000_000),
        _make_invoice("C", "D", 1_000_000),
        _make_invoice("D", "E", 1_000_000),
        _make_invoice("E", "A", 1_000_000),
    ]
    db = _make_db(invoices)
    result = run_optimal(db)

    assert result["lp_status"] == "optimal"

    # Build per-company inflow/outflow from cleared_edges
    inflow = {}
    outflow = {}
    for edge in result["cleared_edges"]:
        f, t, amt = edge["from_id"], edge["to_id"], edge["cleared_cents"]
        outflow[f] = outflow.get(f, 0) + amt
        inflow[t] = inflow.get(t, 0) + amt

    all_companies = set(inflow) | set(outflow)
    for company in all_companies:
        assert inflow.get(company, 0) >= outflow.get(company, 0), (
            f"Conservation violated for {company}: "
            f"inflow={inflow.get(company,0)} outflow={outflow.get(company,0)}"
        )


# ---------------------------------------------------------------------------
# 3. Bounds: no edge clears more than its gross obligation
# ---------------------------------------------------------------------------

def test_bounds():
    """No cleared_edge.cleared_cents should exceed cleared_edge.gross_cents."""
    invoices = [
        _make_invoice("A", "B", 500_000),
        _make_invoice("B", "C", 300_000),
        _make_invoice("C", "A", 200_000),
        _make_invoice("A", "C", 150_000),
    ]
    db = _make_db(invoices)
    result = run_optimal(db)

    for edge in result["cleared_edges"]:
        assert edge["cleared_cents"] <= edge["gross_cents"], (
            f"Bounds violated on edge {edge['from_id']}->{edge['to_id']}: "
            f"cleared={edge['cleared_cents']} > gross={edge['gross_cents']}"
        )
        assert edge["cleared_cents"] >= 0, "Cleared amount must be non-negative"


# ---------------------------------------------------------------------------
# 4. Optimality: LP result <= Johnson's result (LP clears more, so residual is lower)
# ---------------------------------------------------------------------------

def test_optimality_lp_geq_johnson():
    """
    LP residual must be <= Johnson's residual.
    (LP clears at least as much as Johnson's heuristic.)

    Use the canonical example from POEA-32 where LP beats Johnson:
      A -> B: €1 000 000
      B -> C: €1 000 000
      C -> A: €1 000 000
      A -> B: €500 000  (second invoice)
      B -> A: €500 000

    Johnson (bilateral first) clears €2 500 000 residual.
    LP clears €3 500 000 of €4 000 000 gross, residual €500 000.
    """
    invoices = [
        _make_invoice("A", "B", 1_000_000),
        _make_invoice("B", "C", 1_000_000),
        _make_invoice("C", "A", 1_000_000),
        _make_invoice("A", "B",   500_000),
        _make_invoice("B", "A",   500_000),
    ]
    db = _make_db(invoices)
    result = run_optimal(db)

    assert result["lp_status"] == "optimal"
    # LP residual <= Johnson residual
    assert result["optimal_cents"] <= result["johnson_cents"], (
        f"LP residual {result['optimal_cents']} > Johnson {result['johnson_cents']}"
    )
    # improvement_over_johnson_cents should be non-negative
    assert result["improvement_over_johnson_cents"] >= 0


# ---------------------------------------------------------------------------
# 5. Integer consistency: all output values are integer cents, sum correctly
# ---------------------------------------------------------------------------

def test_integer_consistency():
    invoices = [
        _make_invoice("X", "Y", 750_000),
        _make_invoice("Y", "Z", 750_000),
        _make_invoice("Z", "X", 750_000),
    ]
    db = _make_db(invoices)
    result = run_optimal(db)

    # All top-level cent fields must be ints
    for field in ("gross_cents", "bilateral_cents", "johnson_cents",
                  "optimal_cents", "optimal_savings_cents",
                  "improvement_over_johnson_cents"):
        assert isinstance(result[field], int), f"{field} is not int: {type(result[field])}"

    # Accounting identity: gross = optimal + savings
    assert result["gross_cents"] == result["optimal_cents"] + result["optimal_savings_cents"], (
        "gross_cents != optimal_cents + optimal_savings_cents"
    )

    # cleared_edges arithmetic: residual = gross - cleared
    for edge in result["cleared_edges"]:
        assert isinstance(edge["cleared_cents"], int)
        assert isinstance(edge["gross_cents"], int)
        assert edge["residual_cents"] == edge["gross_cents"] - edge["cleared_cents"]


# ---------------------------------------------------------------------------
# 6. Determinism: same input twice produces identical output
# ---------------------------------------------------------------------------

def test_determinism():
    invoices = [
        _make_invoice("P", "Q", 400_000),
        _make_invoice("Q", "R", 600_000),
        _make_invoice("R", "P", 500_000),
        _make_invoice("P", "R", 200_000),
    ]
    db1 = _make_db(invoices)
    db2 = _make_db(invoices)

    result1 = run_optimal(db1)
    result2 = run_optimal(db2)

    for field in ("gross_cents", "optimal_cents", "johnson_cents",
                  "bilateral_cents", "optimal_savings_cents", "lp_status"):
        assert result1[field] == result2[field], (
            f"Non-deterministic: {field} differs between runs"
        )


# ---------------------------------------------------------------------------
# 7. Edge case — single bilateral pair: LP should match bilateral exactly
# ---------------------------------------------------------------------------

def test_single_bilateral_pair():
    """
    A -> B: €300 000
    B -> A: €100 000
    Net obligation: A owes B €200 000. No multilateral savings possible.
    LP optimal_cents == bilateral_cents == johnson_cents == 200 000.
    """
    invoices = [
        _make_invoice("A", "B", 300_000),
        _make_invoice("B", "A", 100_000),
    ]
    db = _make_db(invoices)
    result = run_optimal(db)

    assert result["gross_cents"] == 400_000
    assert result["bilateral_cents"] == 200_000
    assert result["johnson_cents"] == 200_000
    # LP can do no better than bilateral here
    assert result["optimal_cents"] == 200_000
    assert result["improvement_over_johnson_cents"] == 0


# ---------------------------------------------------------------------------
# 8. Edge case — perfect triangle: LP should clear 100% (same as Johnson)
# ---------------------------------------------------------------------------

def test_perfect_triangle():
    """
    A -> B: €500 000
    B -> C: €500 000
    C -> A: €500 000
    Perfect cycle — all three obligations cancel. residual == 0.
    """
    invoices = [
        _make_invoice("A", "B", 500_000),
        _make_invoice("B", "C", 500_000),
        _make_invoice("C", "A", 500_000),
    ]
    db = _make_db(invoices)
    result = run_optimal(db)

    assert result["gross_cents"] == 1_500_000
    assert result["optimal_cents"] == 0, (
        f"Expected 0 residual for perfect triangle, got {result['optimal_cents']}"
    )
    assert result["johnson_cents"] == 0
    assert result["improvement_over_johnson_cents"] == 0


# ---------------------------------------------------------------------------
# 9. Edge case — no cycles: LP should find zero multilateral savings
# ---------------------------------------------------------------------------

def test_no_cycles_chain():
    """
    Pure chain: A -> B -> C (no return edges). No cycles possible.
    LP residual should equal Johnson residual (both == bilateral residual).
    """
    invoices = [
        _make_invoice("A", "B", 800_000),
        _make_invoice("B", "C", 600_000),
    ]
    db = _make_db(invoices)
    result = run_optimal(db)

    # No cycles means bilateral == johnson == optimal
    assert result["johnson_cents"] == result["bilateral_cents"]
    assert result["optimal_cents"] == result["johnson_cents"]
    assert result["improvement_over_johnson_cents"] == 0


# ---------------------------------------------------------------------------
# 10. Savings percentage is plausible
# ---------------------------------------------------------------------------

def test_savings_pct_plausible():
    """optimal_savings_pct should be in [0, 100]."""
    invoices = [
        _make_invoice("A", "B", 1_000_000),
        _make_invoice("B", "C",   800_000),
        _make_invoice("C", "A",   600_000),
        _make_invoice("D", "A",   400_000),
    ]
    db = _make_db(invoices)
    result = run_optimal(db)

    assert 0.0 <= result["optimal_savings_pct"] <= 100.0
    assert 0.0 <= result["improvement_over_johnson_pct"] <= 100.0


# ---------------------------------------------------------------------------
# 11. lp_status field
# ---------------------------------------------------------------------------

def test_lp_status_field():
    invoices = [_make_invoice("A", "B", 100_000)]
    db = _make_db(invoices)
    result = run_optimal(db)
    assert result["lp_status"] in ("optimal", "fallback_to_johnson", "no_invoices")

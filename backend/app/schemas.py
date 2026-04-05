from __future__ import annotations
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field


# ── Company ────────────────────────────────────────────────────────────────

class CompanyCreate(BaseModel):
    name: str
    sector: Optional[str] = None
    city: Optional[str] = "Hamburg"


class CompanyOut(BaseModel):
    id: str
    name: str
    sector: Optional[str]
    city: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Invoice ────────────────────────────────────────────────────────────────

class InvoiceLineItemCreate(BaseModel):
    description: str
    amount_cents: int = Field(..., gt=0)
    quantity: int = Field(1, ge=1)


class InvoiceLineItemOut(BaseModel):
    id: str
    description: str
    amount_cents: Optional[int]
    quantity: Optional[int]

    class Config:
        from_attributes = True


class InvoiceCreate(BaseModel):
    from_company_id: str
    to_company_id: str
    amount_cents: int = Field(..., gt=0)
    description: Optional[str] = None
    due_date: Optional[date] = None
    line_items: Optional[List[InvoiceLineItemCreate]] = None


class InvoiceOut(BaseModel):
    id: str
    from_company_id: str
    to_company_id: str
    amount_cents: int
    description: Optional[str]
    status: str
    due_date: Optional[date]
    clearing_cycle_id: Optional[str]
    created_at: datetime
    line_items: List[InvoiceLineItemOut] = []

    class Config:
        from_attributes = True


# ── Clearing ───────────────────────────────────────────────────────────────

class ClearingRunRequest(BaseModel):
    pass  # bilateral is the only supported mode


class NetPositionOut(BaseModel):
    id: str
    company_id: str
    clearing_cycle_id: str
    receivable_cents: int
    payable_cents: int
    net_cents: int

    class Config:
        from_attributes = True


class ClearingResultOut(BaseModel):
    id: str
    clearing_cycle_id: str
    from_company_id: str
    to_company_id: str
    gross_amount_cents: int
    net_amount_cents: int
    invoices_count: int

    class Config:
        from_attributes = True


class ClearingCycleOut(BaseModel):
    id: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class ClearingCycleDetailOut(BaseModel):
    cycle: ClearingCycleOut
    results: List[ClearingResultOut]
    net_positions: List[NetPositionOut]

    # Aggregate summary derived from results
    total_gross_cents: int = 0
    total_net_cents: int = 0
    total_invoices: int = 0
    savings_bps: int = 0


# ── Network / Dashboard ────────────────────────────────────────────────────

class NetworkStats(BaseModel):
    total_companies: int
    total_invoices: int
    total_gross_cents: int
    total_net_cents: int
    savings_bps: int
    savings_percent: float
    last_cycle_at: Optional[datetime]


class CompanyPositionOut(BaseModel):
    company_id: str
    company_name: str
    latest_cycle_id: Optional[str]
    receivable_cents: int
    payable_cents: int
    net_cents: int
    total_sent_cents: int
    total_received_cents: int


# ── Admin Dashboard ────────────────────────────────────────────────────────

class CompanyNetSummary(BaseModel):
    company_id: str
    company_name: str
    receivable_cents: int
    payable_cents: int
    net_cents: int


class AdminDashboardOut(BaseModel):
    latest_cycle: Optional[ClearingCycleOut]
    total_companies: int = 0
    total_invoices: int = 0
    total_gross_cents: int
    total_net_cents: int
    savings_bps: int
    savings_percent: float
    company_positions: List[CompanyNetSummary]


# ── Admin Network Graph ────────────────────────────────────────────────────

class NetworkNode(BaseModel):
    id: str
    name: str
    sector: Optional[str]
    total_volume_cents: int = 0


class NetworkEdge(BaseModel):
    source: str  # from_company_id
    target: str  # to_company_id
    weight: int  # absolute net obligation in cents


class AdminNetworkOut(BaseModel):
    nodes: List[NetworkNode]
    edges: List[NetworkEdge]
    cycle_id: Optional[str] = None


# ── Network Topology (clusters, components, gaps) ─────────────────────────

class TopologyNode(BaseModel):
    id: str
    name: str
    sector: str
    cluster: str
    total_invoice_volume_cents: int = 0
    net_position_cents: int = 0
    component_id: int = 0


class TopologyEdge(BaseModel):
    source: str
    target: str
    total_amount_cents: int


class ClusterGap(BaseModel):
    cluster_a: str
    cluster_b: str


class TopologyOut(BaseModel):
    nodes: List[TopologyNode]
    edges: List[TopologyEdge]
    gaps: List[ClusterGap]
    clusters: List[str]

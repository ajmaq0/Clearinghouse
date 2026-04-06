import uuid
from datetime import date, datetime
from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum, ForeignKey,
    Index, Integer, String, Text
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


def new_uuid():
    return str(uuid.uuid4())


class Company(Base):
    __tablename__ = "companies"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    name = Column(String(255), nullable=False, unique=True)
    sector = Column(String(100))
    city = Column(String(100), default="Hamburg")
    gls_member = Column(Boolean, default=False)
    district = Column(String(100))
    subtype = Column(String(100))
    size = Column(String(50))
    founded = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    invoices_sent = relationship("Invoice", foreign_keys="Invoice.from_company_id", back_populates="from_company")
    invoices_received = relationship("Invoice", foreign_keys="Invoice.to_company_id", back_populates="to_company")
    net_positions = relationship("NetPosition", back_populates="company")


class ClearingCycle(Base):
    __tablename__ = "clearing_cycles"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    status = Column(
        Enum("open", "running", "completed", name="clearing_cycle_status"),
        nullable=False,
        default="open",
    )
    netting_type = Column(
        Enum("bilateral", "multilateral", "optimal", name="clearing_netting_type"),
        nullable=True,
        default="bilateral",
    )
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))

    results = relationship("ClearingResult", back_populates="cycle", cascade="all, delete-orphan")
    net_positions = relationship("NetPosition", back_populates="cycle", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="clearing_cycle")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    from_company_id = Column(UUID(as_uuid=False), ForeignKey("companies.id"), nullable=False)
    to_company_id = Column(UUID(as_uuid=False), ForeignKey("companies.id"), nullable=False)
    amount_cents = Column(Integer, nullable=False)
    description = Column(Text)
    due_date = Column(Date)
    status = Column(
        Enum("pending", "confirmed", "cleared", name="invoice_status"),
        nullable=False,
        default="pending",
    )
    clearing_cycle_id = Column(UUID(as_uuid=False), ForeignKey("clearing_cycles.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    from_company = relationship("Company", foreign_keys=[from_company_id], back_populates="invoices_sent")
    to_company = relationship("Company", foreign_keys=[to_company_id], back_populates="invoices_received")
    line_items = relationship("InvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan")
    clearing_cycle = relationship("ClearingCycle", back_populates="invoices")

    __table_args__ = (
        Index("ix_invoices_from_company_id", "from_company_id"),
        Index("ix_invoices_to_company_id", "to_company_id"),
        Index("ix_invoices_clearing_cycle_id", "clearing_cycle_id"),
    )


class InvoiceLineItem(Base):
    __tablename__ = "invoice_line_items"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    invoice_id = Column(UUID(as_uuid=False), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    description = Column(Text, nullable=False)
    amount_cents = Column(Integer)
    quantity = Column(Integer, default=1)

    invoice = relationship("Invoice", back_populates="line_items")


class ClearingResult(Base):
    __tablename__ = "clearing_results"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    clearing_cycle_id = Column(UUID(as_uuid=False), ForeignKey("clearing_cycles.id", ondelete="CASCADE"), nullable=False)
    from_company_id = Column(UUID(as_uuid=False), ForeignKey("companies.id"), nullable=False)
    to_company_id = Column(UUID(as_uuid=False), ForeignKey("companies.id"), nullable=False)
    gross_amount_cents = Column(Integer, nullable=False)
    net_amount_cents = Column(Integer, nullable=False)
    invoices_count = Column(Integer, nullable=False, default=0)

    cycle = relationship("ClearingCycle", back_populates="results")
    from_company = relationship("Company", foreign_keys=[from_company_id])
    to_company = relationship("Company", foreign_keys=[to_company_id])

    __table_args__ = (
        Index("ix_clearing_results_clearing_cycle_id", "clearing_cycle_id"),
    )


class NetPosition(Base):
    __tablename__ = "net_positions"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    company_id = Column(UUID(as_uuid=False), ForeignKey("companies.id"), nullable=False)
    clearing_cycle_id = Column(UUID(as_uuid=False), ForeignKey("clearing_cycles.id", ondelete="CASCADE"), nullable=False)
    receivable_cents = Column(Integer, nullable=False, default=0)
    payable_cents = Column(Integer, nullable=False, default=0)
    net_cents = Column(Integer, nullable=False, default=0)  # receivable - payable

    cycle = relationship("ClearingCycle", back_populates="net_positions")
    company = relationship("Company", back_populates="net_positions")

    __table_args__ = (
        Index("ix_net_positions_clearing_cycle_id", "clearing_cycle_id"),
    )

"""Initial schema: companies, invoices, clearing_cycles, clearing_results, net_positions

Revision ID: 001
Revises:
Create Date: 2026-04-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enums
    op.execute("CREATE TYPE invoice_status AS ENUM ('pending', 'confirmed', 'cleared')")
    op.execute("CREATE TYPE clearing_cycle_status AS ENUM ('open', 'running', 'completed')")

    # companies
    op.create_table(
        "companies",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("sector", sa.String(100)),
        sa.Column("city", sa.String(100), server_default="Hamburg"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # clearing_cycles (must exist before invoices references it)
    op.create_table(
        "clearing_cycles",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "status",
            sa.Enum("open", "running", "completed", name="clearing_cycle_status", create_type=False),
            nullable=False,
            server_default="open",
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )

    # invoices
    op.create_table(
        "invoices",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("from_company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("to_company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("amount_cents", sa.Integer, nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("due_date", sa.Date),
        sa.Column(
            "status",
            sa.Enum("pending", "confirmed", "cleared", name="invoice_status", create_type=False),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("clearing_cycle_id", UUID(as_uuid=False), sa.ForeignKey("clearing_cycles.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_invoices_from_company_id", "invoices", ["from_company_id"])
    op.create_index("ix_invoices_to_company_id", "invoices", ["to_company_id"])
    op.create_index("ix_invoices_clearing_cycle_id", "invoices", ["clearing_cycle_id"])

    # invoice_line_items
    op.create_table(
        "invoice_line_items",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "invoice_id",
            UUID(as_uuid=False),
            sa.ForeignKey("invoices.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("amount_cents", sa.Integer),
        sa.Column("quantity", sa.Integer, server_default="1"),
    )

    # clearing_results
    op.create_table(
        "clearing_results",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "clearing_cycle_id",
            UUID(as_uuid=False),
            sa.ForeignKey("clearing_cycles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("from_company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("to_company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("gross_amount_cents", sa.Integer, nullable=False),
        sa.Column("net_amount_cents", sa.Integer, nullable=False),
        sa.Column("invoices_count", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_index("ix_clearing_results_clearing_cycle_id", "clearing_results", ["clearing_cycle_id"])

    # net_positions
    op.create_table(
        "net_positions",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=False), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column(
            "clearing_cycle_id",
            UUID(as_uuid=False),
            sa.ForeignKey("clearing_cycles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("receivable_cents", sa.Integer, nullable=False, server_default="0"),
        sa.Column("payable_cents", sa.Integer, nullable=False, server_default="0"),
        sa.Column("net_cents", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_index("ix_net_positions_clearing_cycle_id", "net_positions", ["clearing_cycle_id"])


def downgrade() -> None:
    op.drop_table("net_positions")
    op.drop_table("clearing_results")
    op.drop_table("invoice_line_items")
    op.drop_table("invoices")
    op.drop_table("clearing_cycles")
    op.drop_table("companies")
    op.execute("DROP TYPE IF EXISTS invoice_status")
    op.execute("DROP TYPE IF EXISTS clearing_cycle_status")

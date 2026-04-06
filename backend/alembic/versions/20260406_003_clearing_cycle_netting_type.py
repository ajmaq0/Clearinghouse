"""Add netting_type field to clearing_cycles

Revision ID: 003
Revises: 002
Create Date: 2026-04-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE TYPE clearing_netting_type AS ENUM ('bilateral', 'multilateral', 'optimal')")
    op.add_column(
        "clearing_cycles",
        sa.Column(
            "netting_type",
            sa.Enum("bilateral", "multilateral", "optimal", name="clearing_netting_type"),
            nullable=True,
            server_default="bilateral",
        ),
    )
    # Backfill existing cycles as bilateral (they were all run with the bilateral algorithm)
    op.execute("UPDATE clearing_cycles SET netting_type = 'bilateral' WHERE netting_type IS NULL")


def downgrade() -> None:
    op.drop_column("clearing_cycles", "netting_type")
    op.execute("DROP TYPE clearing_netting_type")

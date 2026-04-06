"""Add GLS-relevant fields to Company: gls_member, district, subtype, size, founded

Revision ID: 002
Revises: 001
Create Date: 2026-04-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("companies", sa.Column("gls_member", sa.Boolean(), nullable=True, server_default="false"))
    op.add_column("companies", sa.Column("district", sa.String(100), nullable=True))
    op.add_column("companies", sa.Column("subtype", sa.String(100), nullable=True))
    op.add_column("companies", sa.Column("size", sa.String(50), nullable=True))
    op.add_column("companies", sa.Column("founded", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("companies", "founded")
    op.drop_column("companies", "size")
    op.drop_column("companies", "subtype")
    op.drop_column("companies", "district")
    op.drop_column("companies", "gls_member")

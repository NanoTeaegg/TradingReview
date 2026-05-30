"""add_cash_flows

Revision ID: 2f7b6a1c9d34
Revises: 9a8d4c6f1b2e
Create Date: 2026-05-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from app.models.types import Money


# revision identifiers, used by Alembic.
revision: str = "2f7b6a1c9d34"
down_revision: Union[str, Sequence[str], None] = "9a8d4c6f1b2e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cash_flows",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("flow_date", sa.Date(), nullable=False),
        sa.Column("flow_type", sa.String(length=20), nullable=False),
        sa.Column("amount", Money(2), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_cash_flows_flow_date", "cash_flows", ["flow_date"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_cash_flows_flow_date", table_name="cash_flows")
    op.drop_table("cash_flows")

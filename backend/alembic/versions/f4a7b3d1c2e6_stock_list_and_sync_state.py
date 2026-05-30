"""stock_list + market_sync_state for per-stock full history

Revision ID: f4a7b3d1c2e6
Revises: e3f6a2c8d9b5
Create Date: 2026-05-30 20:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f4a7b3d1c2e6"
down_revision: Union[str, Sequence[str], None] = "e3f6a2c8d9b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "stock_list",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("ts_code", sa.String(length=12), nullable=False),
        sa.Column("symbol", sa.String(length=12), nullable=True),
        sa.Column("name", sa.String(length=40), nullable=True),
        sa.Column("list_date", sa.Date(), nullable=True),
        sa.Column("list_status", sa.String(length=2), nullable=False, server_default="L"),
        sa.Column("full_history_synced", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("last_synced_date", sa.Date(), nullable=True),
        sa.Column("last_error", sa.String(length=300), nullable=True),
        sa.Column("synced_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ts_code", name="uq_stock_list_ts_code"),
    )

    op.create_table(
        "market_sync_state",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("key", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="idle"),
        sa.Column("current_code", sa.String(length=12), nullable=True),
        sa.Column("message", sa.String(length=200), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key", name="uq_market_sync_state_key"),
    )


def downgrade() -> None:
    op.drop_table("market_sync_state")
    op.drop_table("stock_list")

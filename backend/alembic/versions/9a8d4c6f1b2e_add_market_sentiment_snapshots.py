"""add_market_sentiment_snapshots

Revision ID: 9a8d4c6f1b2e
Revises: e3c275bdf5a2
Create Date: 2026-05-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from app.models.types import Money


# revision identifiers, used by Alembic.
revision: str = "9a8d4c6f1b2e"
down_revision: Union[str, Sequence[str], None] = "e3c275bdf5a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "market_sentiment_snapshots",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("trade_date", sa.Date(), nullable=False),
        sa.Column("is_trading_day", sa.Boolean(), nullable=False),
        sa.Column("up_count", sa.Integer(), nullable=False),
        sa.Column("down_count", sa.Integer(), nullable=False),
        sa.Column("flat_count", sa.Integer(), nullable=False),
        sa.Column("limit_up", sa.Integer(), nullable=False),
        sa.Column("limit_down", sa.Integer(), nullable=False),
        sa.Column("total_volume_billion", Money(2), nullable=False),
        sa.Column("sentiment", sa.String(length=20), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("note", sa.String(length=200), nullable=True),
        sa.Column("fetched_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("trade_date", name="uq_market_sentiment_trade_date"),
    )


def downgrade() -> None:
    op.drop_table("market_sentiment_snapshots")

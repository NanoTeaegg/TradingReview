"""trading_calendar_days: add pretrade_date (align trade_cal output)

Revision ID: e3f6a2c8d9b5
Revises: d2e5f9a1b7c4
Create Date: 2026-05-30 20:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e3f6a2c8d9b5"
down_revision: Union[str, Sequence[str], None] = "d2e5f9a1b7c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("trading_calendar_days") as batch:
        batch.add_column(sa.Column("pretrade_date", sa.Date(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("trading_calendar_days") as batch:
        batch.drop_column("pretrade_date")

"""add trade time

Revision ID: 8f2c6a9d4b1e
Revises: 7d1e4f8a2c9b
Create Date: 2026-06-01 00:00:00.000000

"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8f2c6a9d4b1e"
down_revision: Union[str, Sequence[str], None] = "7d1e4f8a2c9b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


SIDE_MAP = {
    "证券买入": "buy",
    "买入": "buy",
    "证券卖出": "sell",
    "卖出": "sell",
    "担保品划入": "transfer_in",
}


def upgrade() -> None:
    with op.batch_alter_table("trades", recreate="always", naming_convention=NAMING_CONVENTION) as batch:
        batch.add_column(sa.Column("trade_time", sa.String(length=8), nullable=False, server_default=""))
        batch.drop_constraint("uq_trade_identity", type_="unique")
        batch.create_unique_constraint(
            "uq_trade_identity",
            ["account_id", "trade_date", "trade_time", "stock_code", "side", "price", "quantity", "amount"],
        )

    _backfill_trade_time_from_raw_rows()


def downgrade() -> None:
    with op.batch_alter_table("trades", recreate="always", naming_convention=NAMING_CONVENTION) as batch:
        batch.drop_constraint("uq_trade_identity", type_="unique")
        batch.drop_column("trade_time")
        batch.create_unique_constraint(
            "uq_trade_identity",
            ["account_id", "trade_date", "stock_code", "side", "price", "quantity", "amount"],
        )


def _backfill_trade_time_from_raw_rows() -> None:
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            """
            SELECT b.account_id, r.raw_text
            FROM raw_import_rows r
            JOIN import_batches b ON b.id = r.import_batch_id
            WHERE r.raw_text LIKE '%' || char(9) || '%' || char(9) || '%'
            """
        )
    ).fetchall()

    for row in rows:
        parts = str(row.raw_text).split("\t")
        if len(parts) < 11:
            continue

        trade_time = _normalize_time(parts[10].strip())
        if not trade_time:
            continue

        side = _parse_side(parts[4].strip())
        if side is None:
            continue

        trade_date = _normalize_date(parts[0].strip())
        stock_code = parts[2].strip().lstrip("'").zfill(6)
        quantity = _parse_int(parts[5])
        price = _money(parts[6])
        amount = _money(parts[7])
        if not all((trade_date, stock_code, quantity, price, amount)):
            continue

        conn.execute(
            sa.text(
                """
                UPDATE trades
                SET trade_time = :trade_time
                WHERE account_id = :account_id
                  AND trade_date = :trade_date
                  AND trade_time = ''
                  AND stock_code = :stock_code
                  AND side = :side
                  AND price = :price
                  AND quantity = :quantity
                  AND amount = :amount
                """
            ),
            {
                "trade_time": trade_time,
                "account_id": row.account_id,
                "trade_date": trade_date,
                "stock_code": stock_code,
                "side": side,
                "price": price,
                "quantity": quantity,
                "amount": amount,
            },
        )


def _normalize_time(raw: str) -> str:
    parts = raw.split(":")
    if len(parts) == 3 and all(part.isdigit() for part in parts):
        return f"{int(parts[0]):02d}:{int(parts[1]):02d}:{int(parts[2]):02d}"
    if len(raw) == 6 and raw.isdigit():
        return f"{raw[:2]}:{raw[2:4]}:{raw[4:6]}"
    return ""


def _normalize_date(raw: str) -> str:
    if len(raw) == 8 and raw.isdigit():
        return f"{raw[:4]}-{raw[4:6]}-{raw[6:8]}"
    return raw.replace("/", "-")


def _parse_side(raw: str) -> str | None:
    for key, value in SIDE_MAP.items():
        if key in raw:
            return value
    return None


def _parse_int(raw: str) -> int | None:
    try:
        return int(str(raw).replace(",", "").strip())
    except ValueError:
        return None


def _money(raw: str) -> str | None:
    try:
        return str(Decimal(str(raw).replace(",", "").strip()).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP))
    except Exception:
        return None

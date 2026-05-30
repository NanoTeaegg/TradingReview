"""accounts_and_llm_providers

Revision ID: a6c9d2f4e8b1
Revises: f4a7b3d1c2e6
Create Date: 2026-05-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a6c9d2f4e8b1"
down_revision: Union[str, Sequence[str], None] = "f4a7b3d1c2e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def _add_account_column(table_name: str) -> None:
    op.add_column(table_name, sa.Column("account_id", sa.Integer(), nullable=True))
    op.execute(sa.text(f"UPDATE {table_name} SET account_id = 1 WHERE account_id IS NULL"))


def _finalize_account_column(table_name: str, index_name: str) -> None:
    with op.batch_alter_table(table_name, recreate="always", naming_convention=NAMING_CONVENTION) as batch:
        batch.alter_column("account_id", existing_type=sa.Integer(), nullable=False)
        batch.create_foreign_key(
            f"fk_{table_name}_account_id_accounts",
            "accounts",
            ["account_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch.create_index(index_name, ["account_id"])


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_accounts_name"),
    )
    op.create_index("ix_accounts_is_default", "accounts", ["is_default"], unique=False)
    op.execute(
        sa.text(
            "INSERT INTO accounts (id, name, kind, is_default, sort_order) "
            "VALUES (1, '模拟数据', 'demo', 1, 0)"
        )
    )

    for table in (
        "import_batches",
        "trades",
        "cash_flows",
        "trade_intents",
        "review_reports",
        "rule_versions",
        "tags",
    ):
        _add_account_column(table)

    op.add_column("review_reports", sa.Column("provider", sa.String(length=30), nullable=False, server_default="ollama"))

    with op.batch_alter_table("import_batches", recreate="always", naming_convention=NAMING_CONVENTION) as batch:
        batch.alter_column("account_id", existing_type=sa.Integer(), nullable=False)
        batch.drop_constraint("uq_import_batches_file_hash", type_="unique")
        batch.create_foreign_key(
            "fk_import_batches_account_id_accounts",
            "accounts",
            ["account_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch.create_index("ix_import_batches_account_id", ["account_id"])
        batch.create_unique_constraint("uq_import_batches_account_file_hash", ["account_id", "file_hash"])

    with op.batch_alter_table("trades", recreate="always", naming_convention=NAMING_CONVENTION) as batch:
        batch.alter_column("account_id", existing_type=sa.Integer(), nullable=False)
        batch.drop_constraint("uq_trade_identity", type_="unique")
        batch.create_foreign_key("fk_trades_account_id_accounts", "accounts", ["account_id"], ["id"], ondelete="CASCADE")
        batch.create_index("ix_trades_account_id", ["account_id"])
        batch.create_unique_constraint(
            "uq_trade_identity",
            ["account_id", "trade_date", "stock_code", "side", "price", "quantity", "amount"],
        )

    with op.batch_alter_table("tags", recreate="always", naming_convention=NAMING_CONVENTION) as batch:
        batch.alter_column("account_id", existing_type=sa.Integer(), nullable=False)
        batch.drop_constraint("uq_tags_name", type_="unique")
        batch.create_foreign_key("fk_tags_account_id_accounts", "accounts", ["account_id"], ["id"], ondelete="CASCADE")
        batch.create_index("ix_tags_account_id", ["account_id"])
        batch.create_unique_constraint("uq_tags_account_name", ["account_id", "name"])

    _finalize_account_column("cash_flows", "ix_cash_flows_account_id")
    _finalize_account_column("trade_intents", "ix_trade_intents_account_id")
    _finalize_account_column("review_reports", "ix_review_reports_account_id")
    _finalize_account_column("rule_versions", "ix_rule_versions_account_id")

    op.execute(
        sa.text(
            "INSERT OR IGNORE INTO app_settings (key, value) "
            "SELECT 'llm_base_url', value FROM app_settings WHERE key = 'ollama_base_url'"
        )
    )
    op.execute(
        sa.text(
            "INSERT OR IGNORE INTO app_settings (key, value) "
            "SELECT 'llm_model', value FROM app_settings WHERE key = 'ollama_model'"
        )
    )
    op.execute(sa.text("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('llm_provider', 'ollama')"))
    op.execute(sa.text("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('llm_api_key', '')"))


def downgrade() -> None:
    for table, index_name in (
        ("rule_versions", "ix_rule_versions_account_id"),
        ("review_reports", "ix_review_reports_account_id"),
        ("trade_intents", "ix_trade_intents_account_id"),
        ("cash_flows", "ix_cash_flows_account_id"),
    ):
        with op.batch_alter_table(table, recreate="always", naming_convention=NAMING_CONVENTION) as batch:
            batch.drop_index(index_name)
            batch.drop_constraint(f"fk_{table}_account_id_accounts", type_="foreignkey")
            batch.drop_column("account_id")

    with op.batch_alter_table("tags", recreate="always", naming_convention=NAMING_CONVENTION) as batch:
        batch.drop_constraint("uq_tags_account_name", type_="unique")
        batch.drop_index("ix_tags_account_id")
        batch.drop_constraint("fk_tags_account_id_accounts", type_="foreignkey")
        batch.drop_column("account_id")
        batch.create_unique_constraint("uq_tags_name", ["name"])

    with op.batch_alter_table("trades", recreate="always", naming_convention=NAMING_CONVENTION) as batch:
        batch.drop_constraint("uq_trade_identity", type_="unique")
        batch.drop_index("ix_trades_account_id")
        batch.drop_constraint("fk_trades_account_id_accounts", type_="foreignkey")
        batch.drop_column("account_id")
        batch.create_unique_constraint(
            "uq_trade_identity",
            ["trade_date", "stock_code", "side", "price", "quantity", "amount"],
        )

    with op.batch_alter_table("import_batches", recreate="always", naming_convention=NAMING_CONVENTION) as batch:
        batch.drop_constraint("uq_import_batches_account_file_hash", type_="unique")
        batch.drop_index("ix_import_batches_account_id")
        batch.drop_constraint("fk_import_batches_account_id_accounts", type_="foreignkey")
        batch.drop_column("account_id")
        batch.create_unique_constraint("uq_import_batches_file_hash", ["file_hash"])

    op.drop_column("review_reports", "provider")
    op.drop_index("ix_accounts_is_default", table_name="accounts")
    op.drop_table("accounts")

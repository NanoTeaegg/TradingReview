"""Replace trade_intents.tags JSON with intent_tag_link join table.

Revision ID: b5e9c3a7f2d1
Revises: a6c9d2f4e8b1
Create Date: 2026-05-30
"""
from __future__ import annotations

import json
from collections import defaultdict
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b5e9c3a7f2d1"
down_revision: Union[str, Sequence[str], None] = "a6c9d2f4e8b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "intent_tag_link",
        sa.Column("intent_id", sa.Integer(), nullable=False),
        sa.Column("tag_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["intent_id"], ["trade_intents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("intent_id", "tag_id"),
    )
    op.create_index("ix_intent_tag_link_tag_id", "intent_tag_link", ["tag_id"])

    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, account_id, tags FROM trade_intents WHERE tags IS NOT NULL AND tags != '[]'")
    ).fetchall()

    for intent_id, account_id, tags_json in rows:
        tag_names = json.loads(tags_json or "[]")
        for name in tag_names:
            tag_row = conn.execute(
                sa.text("SELECT id FROM tags WHERE account_id = :aid AND name = :name"),
                {"aid": account_id, "name": name},
            ).fetchone()
            if tag_row:
                conn.execute(
                    sa.text(
                        "INSERT OR IGNORE INTO intent_tag_link (intent_id, tag_id) VALUES (:iid, :tid)"
                    ),
                    {"iid": intent_id, "tid": tag_row[0]},
                )

    with op.batch_alter_table("trade_intents") as batch_op:
        batch_op.drop_column("tags")


def downgrade() -> None:
    with op.batch_alter_table("trade_intents") as batch_op:
        batch_op.add_column(sa.Column("tags", sa.Text(), nullable=True))

    conn = op.get_bind()
    links = conn.execute(
        sa.text(
            "SELECT itl.intent_id, t.name "
            "FROM intent_tag_link itl "
            "JOIN tags t ON t.id = itl.tag_id "
            "ORDER BY itl.intent_id"
        )
    ).fetchall()

    intent_tags: dict[int, list[str]] = defaultdict(list)
    for intent_id, tag_name in links:
        intent_tags[intent_id].append(tag_name)

    for intent_id, tag_names in intent_tags.items():
        conn.execute(
            sa.text("UPDATE trade_intents SET tags = :tags WHERE id = :iid"),
            {"tags": json.dumps(tag_names, ensure_ascii=False), "iid": intent_id},
        )

    op.drop_index("ix_intent_tag_link_tag_id", "intent_tag_link")
    op.drop_table("intent_tag_link")

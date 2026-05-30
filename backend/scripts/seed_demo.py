"""
seed_demo.py — 向「模拟数据」账本导入演示交易数据。

用法（在 backend/ 目录下）：
    source .venv/bin/activate
    python scripts/seed_demo.py

如果「模拟数据」账本已有交易记录，脚本会跳过（不重复导入）。
删除 tradingreview.db 后重新运行即可恢复演示数据。
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

import app.models.account  # noqa: F401 — 必须在 db 初始化前导入所有模型
import app.models.cash_flow  # noqa: F401
import app.models.import_batch  # noqa: F401
import app.models.intent  # noqa: F401
import app.models.review  # noqa: F401
import app.models.rule  # noqa: F401
import app.models.trade  # noqa: F401

from datetime import date
from decimal import Decimal

from sqlalchemy import text
from app.core.db import SessionLocal
from app.models.account import Account
from app.models.cash_flow import CashFlow
from app.services.importer import import_file

DEMO_INITIAL_DEPOSIT = Decimal("200000.00")
DEMO_DEPOSIT_DATE = date(2026, 4, 20)  # 首笔交易前一天

DEMO_XLS = pathlib.Path(__file__).parent.parent.parent / "demo" / "20260421_20260528_demo.xls"


def main() -> None:
    if not DEMO_XLS.exists():
        print(f"[seed_demo] 找不到演示文件：{DEMO_XLS}")
        sys.exit(1)

    db = SessionLocal()
    try:
        # 确保数据库已迁移（accounts 表存在）
        result = db.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'")).fetchone()
        if not result:
            print("[seed_demo] 请先运行 alembic upgrade head 再执行本脚本")
            sys.exit(1)

        # 获取或创建「模拟数据」账本
        demo = db.query(Account).filter(Account.name == "模拟数据").first()
        if not demo:
            demo = Account(name="模拟数据", kind="demo", is_default=True, sort_order=0)
            db.add(demo)
            db.commit()
            db.refresh(demo)
            print(f"[seed_demo] 创建「模拟数据」账本 id={demo.id}")

        # 检查是否已有交易
        from app.models.trade import Trade
        count = db.query(Trade).filter(Trade.account_id == demo.id).count()
        if count > 0:
            print(f"[seed_demo] 「模拟数据」已有 {count} 条交易，跳过导入。")
            print("           若要重新导入，请先删除该账本下的数据或新建数据库。")
            return

        # 插入初始入金（首笔交易前一天）
        flow = CashFlow(account_id=demo.id, flow_date=DEMO_DEPOSIT_DATE, flow_type="deposit", amount=DEMO_INITIAL_DEPOSIT)
        db.add(flow)
        db.commit()
        print(f"[seed_demo] 已插入初始入金 ¥{DEMO_INITIAL_DEPOSIT:,.0f}（{DEMO_DEPOSIT_DATE}）")

        content = DEMO_XLS.read_bytes()
        result = import_file(db, DEMO_XLS.name, content, account_id=demo.id)
        print(f"[seed_demo] 导入成功：{result.inserted} 条交易")
        if result.failed:
            print(f"[seed_demo] 失败 {len(result.failed)} 行：")
            for row in result.failed:
                print(f"  行 {row['row_no']}: {row['error']}")
    finally:
        db.close()


if __name__ == "__main__":
    main()

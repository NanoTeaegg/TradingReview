"""
seed_demo.py — 向「模拟数据」账本导入演示交易数据。

用法（在 backend/ 目录下）：
    source .venv/bin/activate
    python scripts/seed_demo.py

如果「模拟数据」账本已有交易记录，脚本会跳过导入但仍会补充标签数据。
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
from app.models.intent import Tag, TradeIntent
from app.models.trade import Trade
from app.services.importer import import_file

DEMO_INITIAL_DEPOSIT = Decimal("200000.00")
DEMO_DEPOSIT_DATE = date(2026, 4, 20)  # 首笔交易前一天

DEMO_XLS = pathlib.Path(__file__).parent.parent.parent / "demo" / "20260421_20260528_demo.xls"

# 演示标签定义
DEMO_TAGS = [
    ("趋势跟踪", "#3B82F6"),
    ("底部反弹", "#22C55E"),
    ("基本面驱动", "#8B5CF6"),
    ("消息催化", "#F97316"),
    ("板块联动", "#06B6D4"),
]

# 演示交易意图数据 — key: (stock_code, side, date_str)
DEMO_INTENTS = [
    # ---- 买入意图 ----
    {
        "key": ("000651", "buy", "2026-04-21"),
        "tags": ["趋势跟踪", "板块联动"],
        "thesis": "家电板块整体走强，格力电器技术面突破前高，趋势确立，同步跟随板块联动机会。",
        "confidence": 4,
    },
    {
        "key": ("600036", "buy", "2026-04-22"),
        "tags": ["基本面驱动"],
        "thesis": "招商银行 ROE 长期维持 15% 以上，估值处于历史低位，基本面强劲配合低估值买入。",
        "confidence": 4,
    },
    {
        "key": ("000333", "buy", "2026-04-23"),
        "tags": ["趋势跟踪", "板块联动"],
        "thesis": "美的集团与格力同属白色家电，板块联动效应明显，趋势持续向上。",
        "confidence": 3,
    },
    {
        "key": ("601318", "buy", "2026-04-25"),
        "tags": ["基本面驱动"],
        "thesis": "中国平安保费收入恢复增长，基本面改善，股息率具有吸引力。",
        "confidence": 3,
    },
    {
        "key": ("000002", "buy", "2026-04-25"),
        "tags": ["底部反弹"],
        "thesis": "万科 A 经历大幅调整后处于底部区域，政策面利好房地产，反弹机会明显。",
        "confidence": 3,
    },
    {
        "key": ("600519", "buy", "2026-04-29"),
        "tags": ["消息催化"],
        "thesis": "茅台生肖酒发布消息催化，叠加节假日旺季效应，短期催化明显。",
        "confidence": 4,
    },
    {
        "key": ("300750", "buy", "2026-05-06"),
        "tags": ["趋势跟踪"],
        "thesis": "宁德时代新能源汽车渗透率持续提升，趋势性机会，中线跟踪。",
        "confidence": 4,
    },
    {
        "key": ("002415", "buy", "2026-05-12"),
        "tags": ["趋势跟踪"],
        "thesis": "海康威视受益于安防行业景气度提升，技术面突破整理区间，趋势向上。",
        "confidence": 3,
    },
    {
        "key": ("600276", "buy", "2026-05-15"),
        "tags": ["基本面驱动"],
        "thesis": "恒瑞医药创新药管线丰富，研发实力雄厚，长期基本面看好。",
        "confidence": 4,
    },
    {
        "key": ("601288", "buy", "2026-05-20"),
        "tags": ["底部反弹"],
        "thesis": "农业银行股价处于相对低位，国有银行估值修复机会，股息率吸引力强。",
        "confidence": 3,
    },
    {
        "key": ("002714", "buy", "2026-05-22"),
        "tags": ["消息催化"],
        "thesis": "生猪价格触底反弹消息驱动，牧原股份作为行业龙头弹性最大。",
        "confidence": 4,
    },
    {
        "key": ("600016", "buy", "2026-05-26"),
        "tags": ["底部反弹"],
        "thesis": "民生银行经历深度调整，估值极低，底部布局等待修复。",
        "confidence": 2,
    },
    {
        "key": ("000858", "buy", "2026-05-28"),
        "tags": ["基本面驱动"],
        "thesis": "五粮液中报业绩预期向好，估值合理，基本面驱动长线配置。",
        "confidence": 3,
    },
    # ---- 卖出意图（用于标签维度胜率计算） ----
    {
        "key": ("000651", "sell", "2026-04-28"),
        "tags": ["趋势跟踪", "板块联动"],
        "thesis": "达到预期目标价，获利了结，7 日涨幅接近 4%。",
        "confidence": 4,
    },
    {
        "key": ("600036", "sell", "2026-04-30"),
        "tags": ["基本面驱动"],
        "thesis": "短期涨幅到位，估值回归合理区间，减仓兑现收益。",
        "confidence": 3,
    },
    {
        "key": ("000333", "sell", "2026-04-30"),
        "tags": ["趋势跟踪", "板块联动"],
        "thesis": "板块情绪退潮，量能萎缩，及时止盈。",
        "confidence": 3,
    },
    {
        "key": ("601318", "sell", "2026-05-07"),
        "tags": ["基本面驱动"],
        "thesis": "中国平安涨至目标价区间，兑现基本面预期收益。",
        "confidence": 3,
    },
    {
        "key": ("600519", "sell", "2026-05-08"),
        "tags": ["消息催化"],
        "thesis": "消息催化效应消退，节日结束后提前锁定利润。",
        "confidence": 4,
    },
    {
        "key": ("000002", "sell", "2026-05-13"),
        "tags": ["底部反弹"],
        "thesis": "万科短期反弹目标实现，减仓规避地产后续下行风险。",
        "confidence": 3,
    },
    {
        "key": ("300750", "sell", "2026-05-16"),
        "tags": ["趋势跟踪"],
        "thesis": "新能源板块短期冲高，获利了结，等待回调再入。",
        "confidence": 4,
    },
    {
        "key": ("002415", "sell", "2026-05-19"),
        "tags": ["趋势跟踪"],
        "thesis": "海康威视短线目标到位，趋势动能略有放缓，先行减仓。",
        "confidence": 3,
    },
    {
        "key": ("600276", "sell", "2026-05-20"),
        "tags": ["基本面驱动"],
        "thesis": "恒瑞医药短期涨幅较大，部分兑现，持续跟踪基本面。",
        "confidence": 4,
    },
    {
        "key": ("601288", "sell", "2026-05-22"),
        "tags": ["底部反弹"],
        "thesis": "农业银行快速修复到位，兑现底部反弹收益。",
        "confidence": 3,
    },
    {
        "key": ("002714", "sell", "2026-05-27"),
        "tags": ["消息催化"],
        "thesis": "生猪板块催化效应快速发酵，当日涨幅显著，及时止盈。",
        "confidence": 4,
    },
    {
        "key": ("600016", "sell", "2026-05-28"),
        "tags": ["底部反弹"],
        "thesis": "民生银行短线止盈，获利了结，涨幅约 4.7%。",
        "confidence": 2,
    },
]


def seed_tags_and_intents(db, account_id: int) -> None:
    existing = db.query(Tag).filter(Tag.account_id == account_id).count()
    if existing > 0:
        print(f"[seed_demo] 标签已存在（{existing} 个），跳过标签 & 意图导入。")
        return

    # 创建标签
    tag_map: dict[str, Tag] = {}
    for name, color in DEMO_TAGS:
        tag = Tag(account_id=account_id, name=name, color=color)
        db.add(tag)
        tag_map[name] = tag
    db.flush()

    # 建立交易查找表：(stock_code, side, date_str) → Trade
    trades = db.query(Trade).filter(Trade.account_id == account_id).all()
    trade_map: dict[tuple, Trade] = {}
    for t in trades:
        trade_map[(t.stock_code, t.side, str(t.trade_date))] = t

    # 创建交易意图
    inserted = 0
    for data in DEMO_INTENTS:
        trade = trade_map.get(data["key"])
        if not trade:
            print(f"[seed_demo] 警告：找不到交易 {data['key']}，跳过。")
            continue
        intent = TradeIntent(
            account_id=account_id,
            trade_id=trade.id,
            stock_code=trade.stock_code,
            thesis=data["thesis"],
            confidence=data["confidence"],
        )
        intent.tag_objects = [tag_map[name] for name in data["tags"] if name in tag_map]
        db.add(intent)
        inserted += 1

    db.commit()
    print(f"[seed_demo] 已添加 {len(DEMO_TAGS)} 个标签、{inserted} 条交易意图记录。")


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
        count = db.query(Trade).filter(Trade.account_id == demo.id).count()
        if count > 0:
            print(f"[seed_demo] 「模拟数据」已有 {count} 条交易，跳过导入。")
        else:
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

        # 补充标签和交易意图数据（幂等，已存在则跳过）
        seed_tags_and_intents(db, demo.id)

    finally:
        db.close()


if __name__ == "__main__":
    main()

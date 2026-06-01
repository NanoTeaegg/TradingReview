import os
from decimal import Decimal
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.core.db import Base
from app.models.account import Account
from app.services.importer import import_file, ImportResult

FIXTURE = os.path.join(os.path.dirname(__file__), "..", "..", "demo", "20260421_20260528_demo.xls")


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def set_pragma(dbapi_connection, _):
        cur = dbapi_connection.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    session.add(Account(id=1, name="主账户", kind="live", is_default=True, sort_order=0))
    session.commit()
    yield session
    session.close()


def test_import_sample(db):
    with open(FIXTURE, "rb") as f:
        content = f.read()
    result = import_file(db, "20260421_20260528_demo.xls", content, 1)
    assert isinstance(result, ImportResult)
    assert result.inserted >= 20, f"Expected >=20 rows, got {result.inserted}"
    assert len(result.failed) == 0


def test_duplicate_rejected(db):
    with open(FIXTURE, "rb") as f:
        content = f.read()
    import_file(db, "20260421_20260528_demo.xls", content, 1)
    with pytest.raises(ValueError, match="已导入"):
        import_file(db, "20260421_20260528_demo.xls", content, 1)


def test_transfer_in_mapped(db):
    with open(FIXTURE, "rb") as f:
        content = f.read()
    result = import_file(db, "20260421_20260528_demo.xls", content, 1)
    from app.models.trade import Trade
    buys = db.query(Trade).filter(Trade.side == "buy").count()
    sells = db.query(Trade).filter(Trade.side == "sell").count()
    assert buys + sells > 0


def test_import_ths_export_with_operation_and_average_price_columns(db):
    content = (
        "交易日期\t合同编号\t股票代码\t股票名称\t操作\t成交数量\t成交均价\t成交金额\t成交编号\t成交时间\r\n"
        "2026-05-29\t283790\t001309\t德明利\t证券买入\t300\t658.500\t197550.000\t0104000042953738\t10:36:30\r\n"
        "2026-05-29\t197146\t001309\t德明利\t证券卖出\t400\t654.300\t261720.000\t0104000028325444\t10:02:54\r\n"
    ).encode("gb18030")

    result = import_file(db, "2026-06-01.xls", content, 1)

    assert result.inserted == 2
    assert len(result.failed) == 0
    from app.models.trade import Trade
    times = [t.trade_time for t in db.query(Trade).order_by(Trade.id).all()]
    assert times == ["10:36:30", "10:02:54"]


def test_import_rejects_ambiguous_price_column(db):
    content = (
        "成交日期\t证券代码\t证券名称\t操作\t成交数量\t价格\t成交金额\r\n"
        "20260529\t001309\t德明利\t证券买入\t300\t658.500\t197550.000\r\n"
    ).encode("gb18030")

    with pytest.raises(ValueError, match="缺少必需字段：成交价格.*检测到表头"):
        import_file(db, "ambiguous-price.xls", content, 1)


def test_overlapping_trade_in_different_export_is_skipped(db):
    standard_content = (
        "成交日期\t证券代码\t证券名称\t买卖标志\t成交价格\t成交数量\t成交金额\t交易市场\t摘要\r\n"
        "20260529\t001309\t德明利\t证券买入\t658.500\t300\t197550.000\t深Ａ\t\r\n"
    ).encode("gb18030")
    contract_content = (
        "交易日期\t合同编号\t股票代码\t股票名称\t操作\t成交数量\t成交均价\t成交金额\t交易市场\t成交编号\t成交时间\r\n"
        "2026-05-29\t283790\t001309\t德明利\t证券买入\t300\t658.500\t197550.000\t深Ａ\t0104000042953738\t10:36:30\r\n"
    ).encode("gb18030")

    first = import_file(db, "standard.xls", standard_content, 1)
    second = import_file(db, "contract.xls", contract_content, 1)

    assert first.inserted == 1
    assert second.inserted == 0
    assert second.skipped_dup == 1
    assert len(second.failed) == 0
    from app.models.trade import Trade
    trade = db.query(Trade).one()
    assert trade.trade_time == "10:36:30"

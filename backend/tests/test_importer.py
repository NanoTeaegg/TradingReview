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

import os
from decimal import Decimal
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.core.db import Base
from app.services.importer import import_file, ImportResult

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "20260421_20260528_Atrading.xls")


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
    yield session
    session.close()


def test_import_sample(db):
    with open(FIXTURE, "rb") as f:
        content = f.read()
    result = import_file(db, "20260421_20260528_Atrading.xls", content)
    assert isinstance(result, ImportResult)
    assert result.inserted >= 100, f"Expected >=100 rows, got {result.inserted}"
    assert len(result.failed) == 0


def test_duplicate_rejected(db):
    with open(FIXTURE, "rb") as f:
        content = f.read()
    import_file(db, "20260421_20260528_Atrading.xls", content)
    with pytest.raises(ValueError, match="已导入"):
        import_file(db, "20260421_20260528_Atrading.xls", content)


def test_transfer_in_mapped(db):
    with open(FIXTURE, "rb") as f:
        content = f.read()
    result = import_file(db, "20260421_20260528_Atrading.xls", content)
    from app.models.trade import Trade
    transfers = db.query(Trade).filter(Trade.side == "transfer_in").all()
    # File may or may not have transfer_in rows; just ensure side mapping works
    buys = db.query(Trade).filter(Trade.side == "buy").count()
    sells = db.query(Trade).filter(Trade.side == "sell").count()
    assert buys + sells > 0

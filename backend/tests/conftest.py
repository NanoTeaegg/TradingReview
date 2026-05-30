# Import all models so SQLAlchemy relationship strings resolve correctly
import app.models.import_batch
import app.models.account
import app.models.trade
import app.models.intent
import app.models.review
import app.models.rule
import app.models.setting
import app.models.market_cache
import app.models.cash_flow

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.core.db import Base
from app.models.account import Account


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

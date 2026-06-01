from datetime import date
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_session
from app.core.db import Base
from app.main import app
from app.models.account import Account
from app.models.trade import Trade


def _make_client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def set_pragma(dbapi_connection, _):
        cur = dbapi_connection.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    session.add(Account(id=1, name="主账户", kind="live", is_default=True, sort_order=0))
    session.add(Account(id=2, name="模拟账户", kind="demo", is_default=False, sort_order=1))
    session.commit()

    def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    client = TestClient(app)
    return client, session


def test_delete_account_requires_exact_name():
    client, session = _make_client()
    try:
        resp = client.request("DELETE", "/api/accounts/2", json={"name": "错的名字"})
        assert resp.status_code == 400
        assert session.get(Account, 2) is not None

        resp = client.request("DELETE", "/api/accounts/2", json={"name": "模拟账户"})
        assert resp.status_code == 200
        assert resp.json() == {"ok": True}
        assert session.get(Account, 2) is None
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_delete_last_account_rejected():
    client, session = _make_client()
    try:
        session.delete(session.get(Account, 2))
        session.commit()

        resp = client.request("DELETE", "/api/accounts/1", json={"name": "主账户"})
        assert resp.status_code == 409
        assert session.get(Account, 1) is not None
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_llm_settings_masks_api_key():
    client, session = _make_client()
    try:
        resp = client.put(
            "/api/settings/llm",
            json={
                "provider": "openai_compatible",
                "base_url": "https://api.deepseek.com/v1",
                "model": "deepseek-chat",
                "api_key": "sk-1234567890abcdef",
            },
        )
        assert resp.status_code == 200

        resp = client.get("/api/settings/llm")
        assert resp.status_code == 200
        data = resp.json()
        assert data["has_api_key"] is True
        assert data["api_key_masked"] == "sk-****cdef"
        assert "1234567890" not in str(data)
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_fee_settings_are_account_scoped_and_can_recalculate_history():
    client, session = _make_client()
    try:
        session.add(
            Trade(
                account_id=2,
                trade_date=date(2026, 1, 2),
                seq=0,
                ts_code="600000.SH",
                stock_code="600000",
                stock_name="浦发银行",
                side="sell",
                price=Decimal("10"),
                quantity=10000,
                amount=Decimal("100000"),
                fee=Decimal("0"),
                market="SH",
            )
        )
        session.commit()

        resp = client.get("/api/settings/fee", headers={"X-Account-Id": "2"})
        assert resp.status_code == 200
        assert resp.json()["commission_rate"] == "0.00040000"
        assert resp.json()["commission_min_fee_exempt"] is False

        resp = client.put(
            "/api/settings/fee",
            headers={"X-Account-Id": "2"},
            json={"commission_rate": "0.0002", "commission_min_fee_exempt": True},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["commission_rate"] == "0.00020000"
        assert data["commission_min_fee_exempt"] is True
        assert data["recalculated_count"] == 1
        assert session.get(Account, 1).commission_rate == Decimal("0.00040000")
        assert session.get(Account, 2).commission_rate == Decimal("0.00020000")
        assert session.get(Account, 1).commission_min_fee_exempt is False
        assert session.get(Account, 2).commission_min_fee_exempt is True
        # 总佣金 100000×万2 = 20（免5、不补足）+ 印花税 50（卖出）= 70
        assert session.query(Trade).filter(Trade.account_id == 2).one().fee == Decimal("70.0000")
    finally:
        app.dependency_overrides.clear()
        session.close()


def test_fee_settings_rejects_commission_rate_above_max():
    client, session = _make_client()
    try:
        resp = client.put(
            "/api/settings/fee",
            headers={"X-Account-Id": "1"},
            json={"commission_rate": "0.0031", "commission_min_fee_exempt": False},
        )
        assert resp.status_code == 400
        assert "commission_rate" in resp.json()["detail"]
    finally:
        app.dependency_overrides.clear()
        session.close()

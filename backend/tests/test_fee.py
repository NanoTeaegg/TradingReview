from decimal import Decimal
from app.services.fee import calc_fee


def test_buy_sz():
    # 总佣金 = 100000 × 万4 = 40（已含规费），买入无印花税
    fee = calc_fee("buy", "SZ", Decimal("100000"))
    assert fee == Decimal("40.00")


def test_buy_sh():
    fee = calc_fee("buy", "SH", Decimal("100000"))
    assert fee == Decimal("40.00")


def test_sell_sz():
    # 总佣金 40 + 印花税 50
    fee = calc_fee("sell", "SZ", Decimal("100000"))
    assert fee == Decimal("90.00")


def test_sell_sh():
    fee = calc_fee("sell", "SH", Decimal("100000"))
    assert fee == Decimal("90.00")


def test_transfer_in():
    fee = calc_fee("transfer_in", "SZ", Decimal("999999"))
    assert fee == Decimal("0")


def test_min_commission_applies_by_default():
    # 总佣金 = 1000 × 万4 = 0.4 < 5，未免5补足到 5
    fee = calc_fee("buy", "SZ", Decimal("1000"))
    assert fee == Decimal("5.00")


def test_min_commission_floor_then_stamp_on_sell():
    # 总佣金补足到 5，卖出再叠加印花税 0.5
    fee = calc_fee("sell", "SZ", Decimal("1000"))
    assert fee == Decimal("5.50")


def test_min_commission_floor_not_triggered_when_total_exceeds_5():
    # 总佣金 = 20000 × 万4 = 8 > 5，不补足
    fee = calc_fee("buy", "SZ", Decimal("20000"))
    assert fee == Decimal("8.00")


def test_min_commission_can_be_exempted():
    # 免5：总佣金 0.4 不补足
    fee = calc_fee("buy", "SZ", Decimal("1000"), Decimal("0.0004"), True)
    assert fee == Decimal("0.40")


def test_custom_commission_rate():
    # 总佣金 = 100000 × 万2 = 20
    fee = calc_fee("buy", "SZ", Decimal("100000"), Decimal("0.0002"))
    assert fee == Decimal("20.00")


def test_total_commission_matches_broker_statement():
    # 真实案例：德明利卖出，成交金额 261720，总佣金费率万0.8（券商交割单「佣金」口径）
    # 总佣金 261720 × 0.00008 = 20.9376 + 印花税 130.86 = 151.7976 → 151.80
    fee = calc_fee("sell", "SZ", Decimal("261720"), Decimal("0.00008"))
    assert fee == Decimal("151.80")

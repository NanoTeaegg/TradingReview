from decimal import Decimal
from app.services.fee import calc_fee


def test_buy_sz():
    fee = calc_fee("buy", "SZ", Decimal("100000"))
    # commission: max(100000*0.00008, 5) = max(8, 5) = 8
    assert fee == Decimal("8.00")


def test_buy_sh():
    fee = calc_fee("buy", "SH", Decimal("100000"))
    # commission: 8 + transfer_fee: 100000*0.00001 = 1 = 9
    assert fee == Decimal("9.00")


def test_sell_sz():
    fee = calc_fee("sell", "SZ", Decimal("100000"))
    # commission: 8 + stamp: 100000*0.0005 = 50 = 58
    assert fee == Decimal("58.00")


def test_sell_sh():
    fee = calc_fee("sell", "SH", Decimal("100000"))
    # commission: 8 + stamp: 50 + transfer: 1 = 59
    assert fee == Decimal("59.00")


def test_transfer_in():
    fee = calc_fee("transfer_in", "SZ", Decimal("999999"))
    assert fee == Decimal("0")


def test_min_commission():
    fee = calc_fee("buy", "SZ", Decimal("1000"))
    # commission: max(1000*0.00008, 5) = max(0.08, 5) = 5
    assert fee == Decimal("5.00")

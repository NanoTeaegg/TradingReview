from decimal import Decimal, ROUND_HALF_UP

Q2 = Decimal("0.01")


def calc_fee(side: str, market: str, amount: Decimal) -> Decimal:
    """Calculate transaction fee per PRD 2.8."""
    if side == "transfer_in":
        return Decimal("0")

    amount = Decimal(str(amount))

    commission = max(amount * Decimal("0.00008"), Decimal("5.00"))
    stamp_tax = amount * Decimal("0.0005") if side == "sell" else Decimal("0")
    transfer_fee = amount * Decimal("0.00001") if market == "SH" else Decimal("0")

    total = commission + stamp_tax + transfer_fee
    return total.quantize(Q2, rounding=ROUND_HALF_UP)

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.trade import Trade

Q2 = Decimal("0.01")
Q8 = Decimal("0.00000001")
DEFAULT_COMMISSION_RATE = Decimal("0.0004")
MAX_COMMISSION_RATE = Decimal("0.003")
MIN_COMMISSION = Decimal("5.00")
REGULATORY_FEE_RATE = Decimal("0.00002")
EXCHANGE_HANDLING_FEE_RATE = Decimal("0.0000341")
TRANSFER_FEE_RATE = Decimal("0.00001")
STAMP_TAX_RATE = Decimal("0.0005")


@dataclass
class FeeConfig:
    commission_rate: Decimal
    commission_min_fee_exempt: bool = False
    regulatory_fee_rate: Decimal = REGULATORY_FEE_RATE
    exchange_handling_fee_rate: Decimal = EXCHANGE_HANDLING_FEE_RATE
    transfer_fee_rate: Decimal = TRANSFER_FEE_RATE
    stamp_tax_rate: Decimal = STAMP_TAX_RATE


def normalize_commission_rate(value: Decimal | str | int | float) -> Decimal:
    rate = Decimal(str(value)).quantize(Q8, rounding=ROUND_HALF_UP)
    if rate < 0:
        raise ValueError("commission_rate must be greater than or equal to 0")
    if rate > MAX_COMMISSION_RATE:
        raise ValueError("commission_rate must be less than or equal to 0.003")
    return rate


def get_fee_config(db: Session, account_id: int) -> FeeConfig:
    account = db.get(Account, account_id)
    if not account:
        raise ValueError("Account not found")
    return FeeConfig(
        commission_rate=account.commission_rate or DEFAULT_COMMISSION_RATE,
        commission_min_fee_exempt=account.commission_min_fee_exempt,
    )


def save_fee_config(
    db: Session,
    account_id: int,
    commission_rate: Decimal,
    commission_min_fee_exempt: bool,
) -> FeeConfig:
    account = db.get(Account, account_id)
    if not account:
        raise ValueError("Account not found")
    account.commission_rate = normalize_commission_rate(commission_rate)
    account.commission_min_fee_exempt = commission_min_fee_exempt
    db.commit()
    db.refresh(account)
    return FeeConfig(
        commission_rate=account.commission_rate,
        commission_min_fee_exempt=account.commission_min_fee_exempt,
    )


def recalculate_trade_fees(db: Session, account_id: int, config: FeeConfig) -> int:
    trades = db.query(Trade).filter(Trade.account_id == account_id).all()
    for trade in trades:
        trade.fee = calc_fee(
            trade.side,
            trade.market,
            trade.amount,
            config.commission_rate,
            config.commission_min_fee_exempt,
        )
    db.commit()
    return len(trades)


def calc_fee(
    side: str,
    market: str,
    amount: Decimal,
    commission_rate: Decimal = DEFAULT_COMMISSION_RATE,
    commission_min_fee_exempt: bool = False,
) -> Decimal:
    """Calculate transaction fee per PRD 2.8."""
    if side == "transfer_in":
        return Decimal("0")

    amount = Decimal(str(amount))
    commission_rate = normalize_commission_rate(commission_rate)

    # commission_rate 为「总佣金」费率，已含券商净佣金 + A股固定规费（证管费+经手费+过户费），
    # 对齐券商交割单上「佣金」一栏的口径，证管费/经手费/过户费不再单独叠加。
    # 「免5」口径：未勾选时，总佣金不得低于 5 元；印花税为税，单独累加、不计入该基数。
    total_commission = amount * commission_rate
    if not commission_min_fee_exempt:
        total_commission = max(total_commission, MIN_COMMISSION)
    stamp_tax = amount * STAMP_TAX_RATE if side == "sell" else Decimal("0")

    total = total_commission + stamp_tax
    return total.quantize(Q2, rounding=ROUND_HALF_UP)

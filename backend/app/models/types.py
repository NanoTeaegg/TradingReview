from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.types import TypeDecorator, String


class Money(TypeDecorator):
    """Store Decimal as TEXT in SQLite to avoid float precision loss."""
    impl = String
    cache_ok = True

    def __init__(self, scale: int = 4, *args, **kwargs):
        self.scale = scale
        super().__init__(*args, **kwargs)

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        quantizer = Decimal(10) ** -self.scale
        return str(Decimal(str(value)).quantize(quantizer, rounding=ROUND_HALF_UP))

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return Decimal(value)

"""Financial calculation utilities"""
from decimal import Decimal, ROUND_HALF_UP


def round_has(value: float, decimals: int = 6) -> float:
    """Round HAS values to 6 decimal places"""
    if value is None:
        return 0.0
    return float(Decimal(str(value)).quantize(Decimal(10) ** -decimals, rounding=ROUND_HALF_UP))


def round_currency(value: float, decimals: int = 2) -> float:
    """Round currency values to 2 decimal places"""
    if value is None:
        return 0.0
    return float(Decimal(str(value)).quantize(Decimal(10) ** -decimals, rounding=ROUND_HALF_UP))


def calculate_material_has(weight_gram: float, fineness: float) -> float:
    """
    Calculate material HAS cost for gold products
    Material HAS = weight * fineness / 1000
    """
    if weight_gram is None or fineness is None:
        return 0.0
    return round_has(weight_gram * fineness / 1000)


def calculate_labor_has(weight_gram: float, labor_rate: float, labor_type_id: int) -> float:
    """
    Calculate labor HAS cost
    PER_GRAM (1): weight * labor_rate
    PER_PIECE (2): labor_rate (flat rate)
    """
    if labor_rate is None:
        return 0.0
    
    if labor_type_id == 1:  # PER_GRAM
        if weight_gram is None:
            return 0.0
        return round_has(weight_gram * labor_rate)
    else:  # PER_PIECE
        return round_has(labor_rate)


def convert_currency_to_has(amount: float, has_price: float) -> float:
    """
    Convert currency amount to HAS
    HAS = amount / has_price
    """
    if amount is None or has_price is None or has_price == 0:
        return 0.0
    return round_has(amount / has_price)


def convert_has_to_currency(has_amount: float, has_price: float) -> float:
    """
    Convert HAS amount to currency
    Currency = has_amount * has_price
    """
    if has_amount is None or has_price is None:
        return 0.0
    return round_currency(has_amount * has_price)


def calculate_profit_margin(cost_has: float, profit_rate_percent: float) -> float:
    """
    Calculate sale HAS value with profit margin
    Sale HAS = cost * (1 + profit_rate/100)
    """
    if cost_has is None or profit_rate_percent is None:
        return 0.0
    return round_has(cost_has * (1 + profit_rate_percent / 100))

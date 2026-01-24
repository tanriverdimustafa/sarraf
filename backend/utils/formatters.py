"""Formatting and code generation utilities"""
from datetime import datetime, timezone
import uuid


def generate_transaction_code(type_code: str) -> str:
    """
    Generate unique transaction code
    Format: TRX-YYYYMMDD-XXXX
    """
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    random_suffix = uuid.uuid4().hex[:4].upper()
    return f"TRX-{date_str}-{random_suffix}"


def generate_party_code(party_type_id: int) -> str:
    """
    Generate party code based on type
    Format: CUST-YYYYMMDD-XXXX or SUP-YYYYMMDD-XXXX
    """
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    random_suffix = uuid.uuid4().hex[:4].upper()
    
    if party_type_id == 1:  # CUSTOMER
        return f"CUST-{date_str}-{random_suffix}"
    elif party_type_id == 2:  # SUPPLIER
        return f"SUP-{date_str}-{random_suffix}"
    else:
        return f"PARTY-{date_str}-{random_suffix}"


def generate_barcode(prefix: str = "PRD") -> str:
    """
    Generate unique barcode for products
    Format: PRD-YYYYMMDD-XXXX
    """
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    random_suffix = uuid.uuid4().hex[:4].upper()
    return f"{prefix}-{date_str}-{random_suffix}"


def parse_transaction_date(date_str: str) -> datetime:
    """
    Parse transaction date string to datetime object
    Supports multiple formats
    """
    formats = [
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d"
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    
    # If no format matches, return current time
    return datetime.now(timezone.utc)


def format_currency(amount: float, currency: str = "TRY") -> str:
    """
    Format currency amount for display
    """
    symbols = {
        "TRY": "₺",
        "USD": "$",
        "EUR": "€",
        "HAS": "HAS"
    }
    symbol = symbols.get(currency, currency)
    
    if currency == "HAS":
        return f"{amount:.6f} {symbol}"
    else:
        return f"{amount:,.2f} {symbol}"

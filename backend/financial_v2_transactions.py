"""
Financial Transactions V2 - Re-export Module

This file has been refactored. All transaction functions have been moved to:
- services/purchase_service.py
- services/sale_service.py
- services/payment_service.py
- services/receipt_service.py
- services/exchange_service.py
- services/hurda_service.py
- services/stock_service.py
- services/base_service.py

This file remains for backward compatibility - it re-exports all functions
from the new service modules.
"""

# Re-export everything from services for backward compatibility
from services import (
    # Base utilities
    parse_transaction_date,
    round_has,
    round_currency,
    generate_transaction_code,
    get_or_create_price_snapshot,
    convert_currency_to_has,
    convert_has_to_currency,
    write_audit_log,
    create_ledger_entry,
    
    # Stock services
    get_or_create_stock_pool,
    add_to_stock_pool,
    consume_from_stock_pool,
    get_stock_pool_info,
    create_stock_lot,
    consume_stock_lots_fifo,
    get_stock_lot_summary,
    
    # Transaction services
    create_purchase_transaction,
    create_sale_transaction,
    create_payment_transaction,
    create_receipt_transaction,
    create_exchange_transaction,
    create_hurda_transaction,
)

# Also export generate_transaction_code from helpers directly
# (some code imports it directly from this file)
from financial_v2_helpers import generate_transaction_code

__all__ = [
    # Base utilities
    "parse_transaction_date",
    "round_has",
    "round_currency",
    "generate_transaction_code",
    "get_or_create_price_snapshot",
    "convert_currency_to_has",
    "convert_has_to_currency",
    "write_audit_log",
    "create_ledger_entry",
    # Stock services
    "get_or_create_stock_pool",
    "add_to_stock_pool",
    "consume_from_stock_pool",
    "get_stock_pool_info",
    "create_stock_lot",
    "consume_stock_lots_fifo",
    "get_stock_lot_summary",
    # Transaction services
    "create_purchase_transaction",
    "create_sale_transaction",
    "create_payment_transaction",
    "create_receipt_transaction",
    "create_exchange_transaction",
    "create_hurda_transaction",
]

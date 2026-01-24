"""Services package - Business logic layer

This package contains all transaction services extracted from financial_v2_transactions.py
"""

# Re-export from base_service
from services.base_service import (
    parse_transaction_date,
    round_has,
    round_currency,
    generate_transaction_code,
    get_or_create_price_snapshot,
    calculate_material_has,
    calculate_labor_has,
    convert_currency_to_has,
    convert_has_to_currency,
    write_audit_log,
    create_cash_movement_internal,
    set_cash_db,
    create_ledger_entry,
)

# Re-export from stock_service
from services.stock_service import (
    get_or_create_stock_pool,
    add_to_stock_pool,
    consume_from_stock_pool,
    get_stock_pool_info,
    create_stock_lot,
    consume_stock_lots_fifo,
    get_stock_lot_summary,
)

# Re-export from transaction services
from services.purchase_service import create_purchase_transaction
from services.sale_service import create_sale_transaction
from services.payment_service import create_payment_transaction
from services.receipt_service import create_receipt_transaction
from services.exchange_service import create_exchange_transaction
from services.hurda_service import create_hurda_transaction

__all__ = [
    # Base utilities
    "parse_transaction_date",
    "round_has",
    "round_currency",
    "generate_transaction_code",
    "get_or_create_price_snapshot",
    "calculate_material_has",
    "calculate_labor_has",
    "convert_currency_to_has",
    "convert_has_to_currency",
    "write_audit_log",
    "create_cash_movement_internal",
    "set_cash_db",
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

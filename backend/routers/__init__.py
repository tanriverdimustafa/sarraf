"""Routers package"""
from .auth import router as auth_router
from .users import router as users_router
from .parties import router as parties_router
from .lookups import router as lookups_router
from .products import router as products_router
from .transactions import router as transactions_router
from .reports import router as reports_router
from .expenses import router as expenses_router
from .inventory import router as inventory_router
from .market import router as market_router
from .admin import router as admin_router
from .unified_ledger import router as unified_ledger_router

__all__ = [
    "auth_router",
    "users_router",
    "parties_router",
    "lookups_router",
    "products_router",
    "transactions_router",
    "reports_router",
    "expenses_router",
    "inventory_router",
    "market_router",
    "admin_router",
    "unified_ledger_router",
]

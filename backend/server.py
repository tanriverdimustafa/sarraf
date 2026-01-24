"""
Kuyumculuk Has Altın Yönetim Sistemi - Main Server
==================================================

Refactored server with modular architecture:
- routers/: API endpoints
- services/: Business logic  
- models/: Data models
- utils/: Helper utilities
"""
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path

# Initialize logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Initialize database module
from database import set_db
set_db(db)

# Import routers
from routers import (
    auth_router,
    users_router, 
    parties_router,
    lookups_router,
    products_router,
    transactions_router,
    reports_router,
    expenses_router,
    inventory_router,
    market_router,
    admin_router,
    unified_ledger_router,
)
from routers.parties import financial_v2_router
from routers.activity_log import router as activity_log_router

# Import module routers with their own prefixes
from cash_management import cash_router, set_database as set_cash_db, init_cash_registers, create_cash_movement_internal
from partner_management import partner_router, set_database as set_partner_db, set_cash_movement_func
from employee_management import employee_router, set_database as set_employee_db, set_cash_movement_func as set_employee_cash_func
from accrual_period_management import accrual_period_router, set_database as set_accrual_period_db, init_accrual_periods
from label_management import label_router, set_database as set_label_db
from stock_count_management import stock_count_router, set_database as set_stock_count_db
from init_unified_ledger import set_database as set_ledger_db, init_unified_ledger_indexes

# Import expense management for initialization
from expense_management import set_expense_db, init_expense_categories

# Import market websocket
from market_websocket import set_database as set_market_db, connect_to_market_websocket

# Import init modules
from init_lookups import init_lookups_if_empty
from database import init_database_indexes

# Import auth helpers for admin user
from auth import hash_password

# Create FastAPI app
app = FastAPI(
    title="Kuyumculuk Yönetim Sistemi",
    description="Has Altın Stok ve Finans Yönetimi API",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploads (product images etc.)
# NOTE: Must use /api/uploads path for Kubernetes ingress routing
uploads_dir = ROOT_DIR / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# Include routers with /api prefix
app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(parties_router, prefix="/api")
app.include_router(lookups_router, prefix="/api")
app.include_router(products_router, prefix="/api")
app.include_router(transactions_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(expenses_router, prefix="/api")
app.include_router(inventory_router, prefix="/api")
app.include_router(market_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(unified_ledger_router, prefix="/api")
app.include_router(financial_v2_router, prefix="/api")
app.include_router(activity_log_router, prefix="/api")

# Include module routers (these have their own /api prefixes)
set_cash_db(db)
app.include_router(cash_router)

set_partner_db(db)
set_cash_movement_func(create_cash_movement_internal)
app.include_router(partner_router)

set_employee_db(db)
set_employee_cash_func(create_cash_movement_internal)
app.include_router(employee_router)

set_accrual_period_db(db)
app.include_router(accrual_period_router)

set_label_db(db)
app.include_router(label_router)

set_stock_count_db(db)
app.include_router(stock_count_router)

# Initialize other modules
set_expense_db(db)
set_ledger_db(db)
set_market_db(db)


# ==================== STARTUP / SHUTDOWN ====================

from datetime import datetime, timezone

async def ensure_admin_user():
    """Ensure admin@kuyumcu.com user exists with correct password and role"""
    admin_email = "admin@kuyumcu.com"
    admin_password = "admin123"
    
    existing_user = await db.users.find_one({"email": admin_email})
    
    if not existing_user:
        user_dict = {
            "id": "USER-ADMIN-001",
            "email": admin_email,
            "password": hash_password(admin_password),
            "name": "Admin Kullanıcı",
            "role": "SUPER_ADMIN",
            "status": "ACTIVE",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_dict)
        logger.info(f"✅ Admin user created: {admin_email}")
    else:
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {
                "password": hash_password(admin_password),
                "role": "SUPER_ADMIN",
                "status": "ACTIVE",
                "is_active": True
            }}
        )
        logger.info(f"✅ Admin user updated: {admin_email}")


async def migrate_party_has_balance():
    """Add has_balance field to existing parties"""
    result = await db.parties.update_many(
        {"has_balance": {"$exists": False}},
        {"$set": {"has_balance": 0.0}}
    )
    if result.modified_count > 0:
        logger.info(f"✅ Migration: {result.modified_count} party'ye has_balance eklendi")


@app.on_event("startup")
async def startup_event():
    """Initialize all modules on startup"""
    logger.info("🚀 Starting Kuyumculuk Yönetim Sistemi...")
    
    # Initialize lookups
    await init_lookups_if_empty(db)
    
    # Initialize cash registers
    await init_cash_registers()
    
    # Initialize expense categories
    await init_expense_categories()
    
    # Initialize accrual periods
    await init_accrual_periods()
    
    # Ensure admin user exists
    await ensure_admin_user()
    
    # Migrate party has_balance
    await migrate_party_has_balance()
    
    # Initialize unified ledger indexes
    await init_unified_ledger_indexes()
    logger.info("✅ Unified ledger initialized")
    
    # Initialize database indexes (minimal strategy)
    await init_database_indexes(db)
    
    # Start WebSocket
    asyncio.create_task(connect_to_market_websocket())
    logger.info("✅ Market WebSocket client started")
    
    logger.info("✅ Startup complete!")


@app.on_event("shutdown")
async def shutdown_db_client():
    """Close database connection on shutdown"""
    logger.info("Shutting down...")
    client.close()
    logger.info("Database connection closed")

"""
MINIMAL Database Index Initialization
=====================================
Production ortamında performans için SADECE KRİTİK indexleri oluşturur.

FELSEFE:
- Az index = Hızlı yazma + Az RAM kullanımı
- Sadece gerçekten kullanılan sorgular için index
- Veri büyüdükçe ihtiyaç oldukça eklenir

TOPLAM: ~27 index
"""

import logging

logger = logging.getLogger(__name__)


async def init_database_indexes(db):
    """
    Sadece kritik indexleri oluştur.
    Fazla index = yavaş yazma + fazla RAM kullanımı
    
    KURAL: Her collection için max 2-4 index
    """
    
    logger.info("🔧 Minimal database indexleri oluşturuluyor...")
    
    try:
        # ==================== PARTIES ====================
        await db.parties.create_index("id", unique=True)
        await db.parties.create_index([("party_type_id", 1), ("is_active", 1)])
        logger.info("✅ PARTIES: 2 index")
        
        # ==================== PRODUCTS ====================
        await db.products.create_index("id", unique=True)
        await db.products.create_index("barcode", unique=True, sparse=True)
        await db.products.create_index([("stock_status_id", 1), ("product_type_id", 1)])
        await db.products.create_index("supplier_party_id", sparse=True)  # Yeni eklendi
        logger.info("✅ PRODUCTS: 4 index")
        
        # ==================== FINANCIAL_TRANSACTIONS ====================
        await db.financial_transactions.create_index("code", unique=True)
        await db.financial_transactions.create_index([("party_id", 1), ("transaction_date", -1)])
        await db.financial_transactions.create_index([("transaction_date", -1)])
        await db.financial_transactions.create_index("idempotency_key", unique=True, sparse=True)
        await db.financial_transactions.create_index("type_code")  # Yeni eklendi
        logger.info("✅ FINANCIAL_TRANSACTIONS: 5 index")
        
        # ==================== UNIFIED_LEDGER ====================
        await db.unified_ledger.create_index("id", unique=True)
        await db.unified_ledger.create_index([("transaction_date", -1), ("type", 1)])
        await db.unified_ledger.create_index([("party_id", 1), ("transaction_date", -1)])
        logger.info("✅ UNIFIED_LEDGER: 3 index")
        
        # ==================== CASH ====================
        await db.cash_registers.create_index("id", unique=True)
        await db.cash_movements.create_index([("cash_register_id", 1), ("created_at", -1)])
        await db.cash_movements.create_index([("transaction_date", -1)])  # Yeni eklendi
        logger.info("✅ CASH: 3 index")
        
        # ==================== USERS ====================
        await db.users.create_index("email", unique=True)
        logger.info("✅ USERS: 1 index")
        
        # ==================== LOOKUP TABLOLARI ====================
        lookups = [
            "party_types", "product_types", "karats", "currencies",
            "payment_methods", "transaction_types", "labor_types",
            "stock_statuses"
        ]
        
        for lookup in lookups:
            try:
                await db[lookup].create_index("id", unique=True)
            except Exception:
                pass
        
        logger.info(f"✅ LOOKUPS: {len(lookups)} index")
        
        # ==================== DİĞER TABLOLAR ====================
        small_tables = ["employees", "partners", "expense_categories", "accrual_periods"]
        
        for table in small_tables:
            try:
                await db[table].create_index("id", unique=True)
            except Exception:
                pass
        
        logger.info(f"✅ DİĞER: {len(small_tables)} index")
        
        # ==================== ÖZET ====================
        total_indexes = 2 + 4 + 5 + 3 + 3 + 1 + len(lookups) + len(small_tables)
        logger.info(f"📊 TOPLAM: {total_indexes} index oluşturuldu (minimal strateji)")
        
    except Exception as e:
        logger.error(f"❌ Index oluşturma hatası: {e}")

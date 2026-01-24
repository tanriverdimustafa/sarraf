"""Initialize lookup tables if they're empty"""
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)
ROOT_DIR = Path(__file__).parent


async def init_lookups_if_empty(db):
    """Initialize lookup tables if they're empty"""
    try:
        logger.info("🔍 Checking lookup tables...")
        
        # Check critical lookups
        party_types_count = await db.party_types.count_documents({})
        currencies_count = await db.currencies.count_documents({})
        payment_methods_count = await db.payment_methods.count_documents({})
        karats_count = await db.karats.count_documents({})
        labor_types_count = await db.labor_types.count_documents({})
        
        if (party_types_count == 0 or currencies_count == 0 or 
            payment_methods_count == 0 or karats_count == 0 or labor_types_count == 0):
            
            logger.info("⚠️  Lookup tables are empty, initializing...")
            
            # Load fixtures
            with open(ROOT_DIR / 'test_fixtures_financial.json', 'r', encoding='utf-8') as f:
                fixtures = json.load(f)
            
            # 1. Party Types
            if party_types_count == 0:
                logger.info("📋 Initializing party_types...")
                party_types = [
                    {"id": 1, "code": "CUSTOMER", "name": "Müşteri"},
                    {"id": 2, "code": "SUPPLIER", "name": "Tedarikçi"},
                    {"id": 3, "code": "BOTH", "name": "Müşteri + Tedarikçi"},
                    {"id": 4, "code": "SARRAFIYE", "name": "Sarrafiye"},
                    {"id": 5, "code": "CASH", "name": "Kasa"},
                    {"id": 6, "code": "BANK", "name": "Banka"},
                    {"id": 7, "code": "FX", "name": "Döviz Kasası"}
                ]
                await db.party_types.insert_many(party_types)
                logger.info(f"✅ Created {len(party_types)} party types")
            
            # 2. Currencies
            if currencies_count == 0:
                logger.info("📋 Initializing currencies...")
                await db.currencies.insert_many(fixtures['currencies'])
                logger.info(f"✅ Created {len(fixtures['currencies'])} currencies")
            
            # 3. Payment Methods
            if payment_methods_count == 0:
                logger.info("📋 Initializing payment_methods...")
                await db.payment_methods.insert_many(fixtures['payment_methods'])
                logger.info(f"✅ Created {len(fixtures['payment_methods'])} payment methods")
            
            # 4. Transaction Types
            transaction_types_count = await db.transaction_types.count_documents({})
            if transaction_types_count == 0:
                logger.info("📋 Initializing transaction_types...")
                await db.transaction_types.insert_many(fixtures['transaction_types'])
                logger.info(f"✅ Created {len(fixtures['transaction_types'])} transaction types")
            
            # 5. Karats
            if karats_count == 0:
                logger.info("📋 Initializing karats...")
                karats = [
                    {"id": 1, "karat": "24K", "fineness": 1.0, "description": "24 ayar (1000 milyem)"},
                    {"id": 2, "karat": "22K", "fineness": 0.916, "description": "22 ayar (916 milyem)"},
                    {"id": 3, "karat": "18K", "fineness": 0.75, "description": "18 ayar (750 milyem)"},
                    {"id": 4, "karat": "14K", "fineness": 0.585, "description": "14 ayar (585 milyem)"}
                ]
                await db.karats.insert_many(karats)
                logger.info(f"✅ Created {len(karats)} karats")
            
            # 6. Labor Types
            if labor_types_count == 0:
                logger.info("📋 Initializing labor_types...")
                labor_types = [
                    {"id": 1, "code": "PER_GRAM", "name": "Gram Başı", "description": "İşçilik gram başına hesaplanır"},
                    {"id": 2, "code": "PER_PIECE", "name": "Adet Başı", "description": "İşçilik adet başına hesaplanır"}
                ]
                await db.labor_types.insert_many(labor_types)
                logger.info(f"✅ Created {len(labor_types)} labor types")
            
            # 7. Product Types - Yeni track_type ile
            product_types_count = await db.product_types.count_documents({})
            if product_types_count == 0:
                logger.info("📋 Initializing product_types with track_type...")
                product_types = [
                    # SARRAFIYE - FIFO TAKİPLİ (22K adet bazlı)
                    {"id": 1, "code": "ZIYNET_QUARTER", "name": "Ziynet Çeyrek", "is_gold_based": True, "track_type": "FIFO", "fixed_weight": 1.75, "unit": "PIECE", "group": "SARRAFIYE"},
                    {"id": 2, "code": "ZIYNET_HALF", "name": "Ziynet Yarım", "is_gold_based": True, "track_type": "FIFO", "fixed_weight": 3.50, "unit": "PIECE", "group": "SARRAFIYE"},
                    {"id": 3, "code": "ZIYNET_FULL", "name": "Ziynet Tam", "is_gold_based": True, "track_type": "FIFO", "fixed_weight": 7.00, "unit": "PIECE", "group": "SARRAFIYE"},
                    {"id": 4, "code": "ATA_QUARTER", "name": "Ata Çeyrek", "is_gold_based": True, "track_type": "FIFO", "fixed_weight": 1.80, "unit": "PIECE", "group": "SARRAFIYE"},
                    {"id": 5, "code": "ATA_HALF", "name": "Ata Yarım", "is_gold_based": True, "track_type": "FIFO", "fixed_weight": 3.60, "unit": "PIECE", "group": "SARRAFIYE"},
                    {"id": 6, "code": "ATA_FULL", "name": "Ata Tam (Reşat)", "is_gold_based": True, "track_type": "FIFO", "fixed_weight": 7.20, "unit": "PIECE", "group": "SARRAFIYE"},
                    {"id": 7, "code": "ATA_BUCUK", "name": "Ata 2.5", "is_gold_based": True, "track_type": "FIFO", "fixed_weight": 4.50, "unit": "PIECE", "group": "SARRAFIYE"},
                    {"id": 8, "code": "ATA_BESLI", "name": "Ata 5'li", "is_gold_based": True, "track_type": "FIFO", "fixed_weight": 36.00, "unit": "PIECE", "group": "SARRAFIYE"},
                    
                    # GRAM ALTIN - FIFO TAKİPLİ
                    {"id": 9, "code": "GRAM_GOLD", "name": "Gram Altın 24K", "is_gold_based": True, "track_type": "FIFO", "fixed_weight": 1.00, "unit": "GRAM", "group": "GRAM_GOLD"},
                    {"id": 10, "code": "GOLD_BULLION", "name": "Külçe Altın", "is_gold_based": True, "track_type": "FIFO", "fixed_weight": None, "unit": "GRAM", "group": "GRAM_GOLD"},
                    
                    # HURDA - TEK HAVUZ
                    {"id": 11, "code": "GOLD_SCRAP", "name": "Hurda Altın", "is_gold_based": True, "track_type": "POOL", "fixed_weight": None, "unit": "GRAM", "group": "HURDA"},
                    
                    # TAKI - UNIQUE (Fotoğraflı, ayrı kayıt)
                    {"id": 12, "code": "GOLD_RING", "name": "Altın Yüzük", "is_gold_based": True, "track_type": "UNIQUE", "fixed_weight": None, "unit": "GRAM", "group": "TAKI"},
                    {"id": 13, "code": "GOLD_BRACELET", "name": "Altın Bilezik 22K", "is_gold_based": True, "track_type": "POOL", "fixed_weight": None, "unit": "GRAM", "group": "BILEZIK"},
                    {"id": 14, "code": "GOLD_NECKLACE", "name": "Altın Kolye", "is_gold_based": True, "track_type": "UNIQUE", "fixed_weight": None, "unit": "GRAM", "group": "TAKI"},
                    {"id": 15, "code": "GOLD_EARRING", "name": "Altın Küpe", "is_gold_based": True, "track_type": "UNIQUE", "fixed_weight": None, "unit": "GRAM", "group": "TAKI"},
                    {"id": 16, "code": "GOLD_PENDANT", "name": "Altın Kolye Ucu", "is_gold_based": True, "track_type": "UNIQUE", "fixed_weight": None, "unit": "GRAM", "group": "TAKI"},
                    {"id": 17, "code": "DIAMOND", "name": "Pırlanta", "is_gold_based": False, "track_type": "UNIQUE", "fixed_weight": None, "unit": "PIECE", "group": "TAKI"},
                    {"id": 18, "code": "OTHER", "name": "Diğer", "is_gold_based": False, "track_type": "UNIQUE", "fixed_weight": None, "unit": "PIECE", "group": "TAKI"},
                ]
                await db.product_types.insert_many(product_types)
                logger.info(f"✅ Created {len(product_types)} product types")
            
            # 8. Stock Statuses
            stock_statuses_count = await db.stock_statuses.count_documents({})
            if stock_statuses_count == 0:
                logger.info("📋 Initializing stock_statuses...")
                stock_statuses = [
                    {"id": 1, "code": "IN_STOCK", "name": "Stokta", "color": "green"},
                    {"id": 2, "code": "SOLD", "name": "Satıldı", "color": "blue"},
                    {"id": 3, "code": "RESERVED", "name": "Rezerve", "color": "yellow"}
                ]
                await db.stock_statuses.insert_many(stock_statuses)
                logger.info(f"✅ Created {len(stock_statuses)} stock statuses")
            
            logger.info("✅ Lookup tables initialized successfully!")
        else:
            logger.info("✅ Lookup tables already populated")
            
    except Exception as e:
        logger.error(f"❌ Error initializing lookups: {e}")
        import traceback
        traceback.print_exc()

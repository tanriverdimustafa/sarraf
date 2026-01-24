"""
Initialize product lookup tables
Run this ONCE to populate lookup data
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def initialize_product_lookups():
    """Initialize all product lookup tables"""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("🚀 Initializing product lookup tables...")
    
    # 1. Product Types - Yeni track_type yapısı
    print("📋 Creating product_types with track_type...")
    await db.product_types.delete_many({})
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
        {"id": 13, "code": "GOLD_BRACELET", "name": "Altın Bilezik", "is_gold_based": True, "track_type": "UNIQUE", "fixed_weight": None, "unit": "GRAM", "group": "TAKI"},
        {"id": 14, "code": "GOLD_NECKLACE", "name": "Altın Kolye", "is_gold_based": True, "track_type": "UNIQUE", "fixed_weight": None, "unit": "GRAM", "group": "TAKI"},
        {"id": 15, "code": "GOLD_EARRING", "name": "Altın Küpe", "is_gold_based": True, "track_type": "UNIQUE", "fixed_weight": None, "unit": "GRAM", "group": "TAKI"},
        {"id": 16, "code": "GOLD_PENDANT", "name": "Altın Kolye Ucu", "is_gold_based": True, "track_type": "UNIQUE", "fixed_weight": None, "unit": "GRAM", "group": "TAKI"},
        {"id": 17, "code": "DIAMOND", "name": "Pırlanta", "is_gold_based": False, "track_type": "UNIQUE", "fixed_weight": None, "unit": "PIECE", "group": "TAKI"},
        {"id": 18, "code": "OTHER", "name": "Diğer", "is_gold_based": False, "track_type": "UNIQUE", "fixed_weight": None, "unit": "PIECE", "group": "TAKI"},
    ]
    await db.product_types.insert_many(product_types)
    print(f"✅ Created {len(product_types)} product types")
    
    # 2. Karats (Ayar)
    print("📋 Creating karats...")
    await db.karats.delete_many({})
    karats = [
        {"id": 1, "karat": 8, "fineness": 0.333},
        {"id": 2, "karat": 14, "fineness": 0.585},
        {"id": 3, "karat": 18, "fineness": 0.750},
        {"id": 4, "karat": 22, "fineness": 0.916},
        {"id": 5, "karat": 24, "fineness": 1.000}
    ]
    await db.karats.insert_many(karats)
    print(f"✅ Created {len(karats)} karats")
    
    # 3. Labor Types
    print("📋 Creating labor_types...")
    await db.labor_types.delete_many({})
    labor_types = [
        {"id": 1, "code": "PER_GRAM", "name": "Gram Başı"},
        {"id": 2, "code": "PER_PIECE", "name": "Adet Başı"}
    ]
    await db.labor_types.insert_many(labor_types)
    print(f"✅ Created {len(labor_types)} labor types")
    
    # 4. Stock Statuses
    print("📋 Creating stock_statuses...")
    await db.stock_statuses.delete_many({})
    stock_statuses = [
        {"id": 1, "code": "IN_STOCK", "name": "Stokta"},
        {"id": 2, "code": "SOLD", "name": "Satıldı"},
        {"id": 3, "code": "RESERVED", "name": "Rezerve"}
    ]
    await db.stock_statuses.insert_many(stock_statuses)
    print(f"✅ Created {len(stock_statuses)} stock statuses")
    
    print("\n✅ All product lookup tables initialized successfully!")
    print("\n📊 Summary:")
    print(f"   - Product Types: {len(product_types)}")
    print(f"   - Karats: {len(karats)}")
    print(f"   - Labor Types: {len(labor_types)}")
    print(f"   - Stock Statuses: {len(stock_statuses)}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(initialize_product_lookups())

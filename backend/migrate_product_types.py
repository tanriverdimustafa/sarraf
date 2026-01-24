#!/usr/bin/env python3
"""
Migration script to update product_types with new track_type field
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'kuyumcu_db')

async def migrate_product_types():
    """Delete old product_types and insert new ones with track_type"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print(f"🔄 Migrating product_types in {DB_NAME} to new structure...")
    
    # Yeni product types tanımları
    new_product_types = [
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
    
    # Mevcut product_types'ı sil
    delete_result = await db.product_types.delete_many({})
    print(f"🗑️  Deleted {delete_result.deleted_count} old product types")
    
    # Yeni product types ekle
    await db.product_types.insert_many(new_product_types)
    print(f"✅ Inserted {len(new_product_types)} new product types with track_type")
    
    # Doğrulama
    count = await db.product_types.count_documents({})
    print(f"📊 Total product types in database: {count}")
    
    # Grupları göster
    groups = await db.product_types.distinct("group")
    print(f"📁 Groups: {groups}")
    
    client.close()
    print("✅ Migration completed!")

if __name__ == "__main__":
    asyncio.run(migrate_product_types())

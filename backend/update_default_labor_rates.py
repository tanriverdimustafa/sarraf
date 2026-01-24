"""
Product types'a default_labor_rate alanını ekle
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = "kuyumcu"

# Default işçilik değerleri
DEFAULT_LABOR_RATES = {
    # Ziynet serisi
    "ZIYNET_QUARTER": 0.044,
    "ZIYNET_HALF": 0.044,
    "ZIYNET_FULL": 0.044,
    
    # Ata serisi
    "ATA_QUARTER": 0.050,
    "ATA_HALF": 0.050,
    "ATA_FULL": 0.050,
    "ATA_BUCUK": 0.050,
    "ATA_BESLI": 0.050,
    
    # Gram/Külçe
    "GRAM_GOLD": 0.003,
    "GOLD_BULLION": 0.000,
    
    # Hurda
    "GOLD_SCRAP": 0.000,
    
    # Takı/Bilezik
    "GOLD_BRACELET": 0.012,
    "GOLD_RING": 0.015,
    "GOLD_NECKLACE": 0.015,
    "GOLD_EARRING": 0.015,
    "GOLD_PENDANT": 0.015,
    
    # Diğer
    "DIAMOND": 0.000,
    "OTHER": 0.010,
}

async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("🔄 Updating product_types with default_labor_rate...")
    
    product_types = await db.product_types.find({}).to_list(100)
    
    for pt in product_types:
        code = pt.get("code")
        default_rate = DEFAULT_LABOR_RATES.get(code, 0.010)  # Default 0.010
        
        await db.product_types.update_one(
            {"id": pt["id"]},
            {"$set": {"default_labor_rate": default_rate}}
        )
        print(f"  ✅ {pt['name']} ({code}): {default_rate}")
    
    print("✅ Done!")
    client.close()

if __name__ == "__main__":
    asyncio.run(main())

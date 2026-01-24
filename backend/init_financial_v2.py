"""
Initialize Financial Transactions V2 Module
- YENİ lookup collection'ları oluştur
- Mevcut collections'a DOKUNMA
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def initialize_financial_v2():
    """Initialize Financial V2 lookups"""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("🚀 Initializing Financial Transactions V2 Module...")
    print("⚠️  Mevcut collections korunuyor, sadece YENİ collections ekleniyor\n")
    
    # Load fixtures
    with open(ROOT_DIR / 'test_fixtures_financial.json', 'r', encoding='utf-8') as f:
        fixtures = json.load(f)
    
    # 1. Transaction Types
    print("📋 Creating transaction_types...")
    await db.transaction_types.delete_many({})
    await db.transaction_types.insert_many(fixtures['transaction_types'])
    await db.transaction_types.create_index([("code", 1)], unique=True)
    print(f"✅ Created {len(fixtures['transaction_types'])} transaction types")
    
    # 2. Payment Methods
    print("📋 Creating payment_methods...")
    await db.payment_methods.delete_many({})
    await db.payment_methods.insert_many(fixtures['payment_methods'])
    await db.payment_methods.create_index([("code", 1)], unique=True)
    print(f"✅ Created {len(fixtures['payment_methods'])} payment methods")
    
    # 3. Currencies
    print("📋 Creating currencies...")
    await db.currencies.delete_many({})
    await db.currencies.insert_many(fixtures['currencies'])
    await db.currencies.create_index([("code", 1)], unique=True)
    print(f"✅ Created {len(fixtures['currencies'])} currencies")
    
    # 4. Price Snapshots (test data)
    print("📋 Creating price_snapshots (test data)...")
    await db.price_snapshots.delete_many({})
    
    for snapshot in fixtures['price_snapshots']:
        snapshot['as_of'] = datetime.fromisoformat(snapshot['as_of'].replace('Z', '+00:00'))
        snapshot['created_at'] = datetime.now(timezone.utc)
    
    await db.price_snapshots.insert_many(fixtures['price_snapshots'])
    await db.price_snapshots.create_index([("as_of", -1)])
    await db.price_snapshots.create_index([("created_at", -1)])
    await db.price_snapshots.create_index([("source", 1), ("as_of", -1)])
    print(f"✅ Created {len(fixtures['price_snapshots'])} price snapshots")
    
    # 5. Financial Transactions collection (boş oluştur, indexes ekle)
    print("📋 Creating financial_transactions collection with indexes...")
    
    # Collection varsa drop etme, sadece indexes ekle
    existing_collections = await db.list_collection_names()
    
    if 'financial_transactions' not in existing_collections:
        await db.create_collection('financial_transactions')
        print("✅ financial_transactions collection oluşturuldu")
    else:
        print("ℹ️  financial_transactions collection zaten mevcut")
    
    # Indexes
    indexes = [
        ([("code", 1)], {"unique": True}),
        ([("party_id", 1), ("transaction_date", -1)], {}),
        ([("type_code", 1), ("transaction_date", -1)], {}),
        ([("status", 1)], {}),
        ([("transaction_date", -1)], {}),
        ([("price_snapshot_id", 1)], {}),
        ([("lines.product_id", 1)], {}),
        ([("lines.sku", 1)], {}),
        ([("idempotency_key", 1), ("created_by", 1)], {"unique": True, "sparse": True})
    ]
    
    for index_spec, options in indexes:
        try:
            await db.financial_transactions.create_index(index_spec, **options)
        except Exception as e:
            print(f"⚠️  Index zaten mevcut veya hata: {e}")
    
    print("✅ financial_transactions indexes oluşturuldu")
    
    # 6. Audit Logs collection
    print("📋 Creating audit_logs collection with indexes...")
    
    if 'audit_logs' not in existing_collections:
        await db.create_collection('audit_logs')
        print("✅ audit_logs collection oluşturuldu")
    else:
        print("ℹ️  audit_logs collection zaten mevcut")
    
    audit_indexes = [
        ([("entity_id", 1), ("created_at", -1)], {}),
        ([("entity", 1), ("created_at", -1)], {}),
        ([("changed_by", 1), ("created_at", -1)], {})
    ]
    
    for index_spec, options in audit_indexes:
        try:
            await db.audit_logs.create_index(index_spec, **options)
        except Exception as e:
            print(f"⚠️  Index zaten mevcut veya hata: {e}")
    
    print("✅ audit_logs indexes oluşturuldu")
    
    print("\n✅ Financial Transactions V2 Module initialization tamamlandı!")
    print("\n📊 Summary:")
    print(f"   - Transaction Types: {len(fixtures['transaction_types'])}")
    print(f"   - Payment Methods: {len(fixtures['payment_methods'])}")
    print(f"   - Currencies: {len(fixtures['currencies'])}")
    print(f"   - Price Snapshots: {len(fixtures['price_snapshots'])}")
    print(f"   - financial_transactions collection: Ready")
    print(f"   - audit_logs collection: Ready")
    
    print("\n⚠️  MEVCUTtransactions collection korundu - değişiklik yapılmadı")
    print("✅ Yeni financial_transactions collection hazır")
    
    print("\n🔥 Next Steps:")
    print("   1. Harem socket service'i başlat (price snapshots için)")
    print("   2. API endpoints'leri test et")
    print("   3. Test senaryolarını çalıştır")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(initialize_financial_v2())

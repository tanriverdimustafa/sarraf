"""
Safe Initialization of ALL Lookups
- Mevcut datayı BOZMADAN eksikleri ekler
- Tüm lookup'ları bir kerede initialize eder
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def safe_upsert(collection, data, unique_field):
    """Insert if not exists, update if exists"""
    for item in data:
        existing = await collection.find_one({unique_field: item[unique_field]})
        if existing:
            print(f"  ⏭️  {item.get('name', item.get('code', item[unique_field]))} zaten var")
        else:
            await collection.insert_one(item)
            print(f"  ✅ {item.get('name', item.get('code', item[unique_field]))} eklendi")

async def safe_init_all_lookups():
    """Initialize all lookups safely"""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("🚀 Safe Lookup Initialization Başlıyor...")
    print("="*60)
    print("⚠️  Mevcut veriler korunacak, sadece eksikler eklenecek")
    print("="*60)
    
    # 1. Party Types (7 tane - tam set)
    print("\n📋 1. PARTY TYPES")
    print("-"*60)
    party_types = [
        {"id": 1, "code": "CUSTOMER", "name": "Müşteri"},
        {"id": 2, "code": "SUPPLIER", "name": "Tedarikçi"},
        {"id": 3, "code": "BOTH", "name": "Müşteri + Tedarikçi"},
        {"id": 4, "code": "CASH", "name": "Kasa"},
        {"id": 5, "code": "BANK", "name": "Banka"},
        {"id": 6, "code": "FX", "name": "Döviz Kasası"},
        {"id": 7, "code": "INTERNAL", "name": "İç Hesap"}
    ]
    await safe_upsert(db.party_types, party_types, 'id')
    
    # 2. Product Types - Yeni track_type yapısı (18 tane)
    print("\n📋 2. PRODUCT TYPES")
    print("-"*60)
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
    await safe_upsert(db.product_types, product_types, 'id')
    
    # 3. Labor Types (2 tane)
    print("\n📋 3. LABOR TYPES")
    print("-"*60)
    labor_types = [
        {"id": 1, "code": "PER_GRAM", "name": "Gram Başı"},
        {"id": 2, "code": "PER_PIECE", "name": "Adet Başı"}
    ]
    await safe_upsert(db.labor_types, labor_types, 'id')
    
    # 4. Karats (5 tane)
    print("\n📋 4. KARATS")
    print("-"*60)
    karats = [
        {"id": 1, "karat": 8, "fineness": 0.333},
        {"id": 2, "karat": 14, "fineness": 0.585},
        {"id": 3, "karat": 18, "fineness": 0.750},
        {"id": 4, "karat": 22, "fineness": 0.916},
        {"id": 5, "karat": 24, "fineness": 1.000}
    ]
    await safe_upsert(db.karats, karats, 'id')
    
    # 5. Stock Statuses (3 tane)
    print("\n📋 5. STOCK STATUSES")
    print("-"*60)
    stock_statuses = [
        {"id": 1, "code": "IN_STOCK", "name": "Stokta"},
        {"id": 2, "code": "SOLD", "name": "Satıldı"},
        {"id": 3, "code": "RESERVED", "name": "Rezerve"}
    ]
    await safe_upsert(db.stock_statuses, stock_statuses, 'id')
    
    # 6. Transaction Types (7 tane)
    print("\n📋 6. TRANSACTION TYPES")
    print("-"*60)
    transaction_types = [
        {"code": "PURCHASE", "name": "Alış", "description": "Ürün/altın alışı", "is_active": True},
        {"code": "SALE", "name": "Satış", "description": "Ürün satışı", "is_active": True},
        {"code": "PAYMENT", "name": "Ödeme", "description": "Para ödemesi", "is_active": True},
        {"code": "RECEIPT", "name": "Tahsilat", "description": "Para tahsilatı", "is_active": True},
        {"code": "EXCHANGE", "name": "Döviz İşlemi", "description": "Döviz alım-satım", "is_active": True},
        {"code": "ADJUSTMENT", "name": "Düzeltme", "description": "Manuel düzeltme", "is_active": True},
        {"code": "HURDA", "name": "Hurda Altın", "description": "Hurda altın kabulü", "is_active": True}
    ]
    await safe_upsert(db.transaction_types, transaction_types, 'code')
    
    # 7. Payment Methods (10 tane - Para birimi bazlı)
    print("\n📋 7. PAYMENT METHODS")
    print("-"*60)
    payment_methods = [
        {"code": "CASH_TRY", "name": "Nakit TL", "commission_rate": 0.0, "is_active": True, "currency": "TRY", "type": "CASH"},
        {"code": "BANK_TRY", "name": "Havale TL", "commission_rate": 0.0, "is_active": True, "currency": "TRY", "type": "BANK"},
        {"code": "CASH_USD", "name": "Nakit USD", "commission_rate": 0.0, "is_active": True, "currency": "USD", "type": "CASH"},
        {"code": "BANK_USD", "name": "Havale USD", "commission_rate": 0.0, "is_active": True, "currency": "USD", "type": "BANK"},
        {"code": "CASH_EUR", "name": "Nakit EUR", "commission_rate": 0.0, "is_active": True, "currency": "EUR", "type": "CASH"},
        {"code": "BANK_EUR", "name": "Havale EUR", "commission_rate": 0.0, "is_active": True, "currency": "EUR", "type": "BANK"},
        {"code": "CREDIT_CARD", "name": "Kredi Kartı", "commission_rate": 0.025, "is_active": True, "currency": "TRY", "type": "BANK"},
        {"code": "CHECK", "name": "Çek", "commission_rate": 0.0, "is_active": True, "currency": "TRY", "type": "BANK"},
        {"code": "GOLD_SCRAP", "name": "Hurda Altın", "commission_rate": 0.0, "is_active": True, "currency": "HAS", "type": "OTHER"},
    ]
    await safe_upsert(db.payment_methods, payment_methods, 'code')
    
    # 8. Currencies (3 tane)
    print("\n📋 8. CURRENCIES")
    print("-"*60)
    currencies = [
        {"code": "TRY", "name": "Türk Lirası", "symbol": "₺", "is_active": True},
        {"code": "USD", "name": "Amerikan Doları", "symbol": "$", "is_active": True},
        {"code": "EUR", "name": "Euro", "symbol": "€", "is_active": True}
    ]
    await safe_upsert(db.currencies, currencies, 'code')
    
    print("\n" + "="*60)
    print("✅ TÜM LOOKUP'LAR BAŞARIYLA İNİTİALİZE EDİLDİ!")
    print("="*60)
    print("\n📊 ÖZET:")
    print(f"   - Party Types: {len(party_types)}")
    print(f"   - Product Types: {len(product_types)}")
    print(f"   - Labor Types: {len(labor_types)}")
    print(f"   - Karats: {len(karats)}")
    print(f"   - Stock Statuses: {len(stock_statuses)}")
    print(f"   - Transaction Types: {len(transaction_types)}")
    print(f"   - Payment Methods: {len(payment_methods)}")
    print(f"   - Currencies: {len(currencies)}")
    print("="*60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(safe_init_all_lookups())

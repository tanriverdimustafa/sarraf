"""
Safe Seed Data Initializer
Duplicate kontrolü ile güvenli test verileri oluşturur
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime, timezone
import bcrypt

load_dotenv()

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
DB_NAME = os.environ.get('DB_NAME', 'kuyumcu_db')

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

async def safe_insert_one(collection, document, unique_field='id'):
    """Insert if not exists"""
    existing = await collection.find_one({unique_field: document[unique_field]})
    if existing:
        print(f"  ⏭️  {document.get('name', document.get('email', document[unique_field]))} zaten var, atlanıyor")
        return None
    result = await collection.insert_one(document)
    print(f"  ✅ {document.get('name', document.get('email', document[unique_field]))} oluşturuldu")
    return result

async def init_seed_data():
    print("🌱 Seed Data Initialize Başlıyor...")
    print("="*60)
    print("Not: Mevcut veriler korunacak, sadece eksikler eklenecek")
    print("="*60)
    
    # 0. Party Types
    print("\n📋 0. PARTY TYPES")
    print("-"*60)
    
    party_types = [
        {"id": 1, "name": "Tedarikçi", "code": "SUPPLIER"},
        {"id": 2, "name": "Müşteri", "code": "CUSTOMER"},
        {"id": 3, "name": "Sarrafiye", "code": "SARRAFIYE"},
    ]
    
    for pt in party_types:
        existing = await db.party_types.find_one({"id": pt["id"]})
        if not existing:
            await db.party_types.insert_one(pt)
            print(f"  ✅ {pt['name']} oluşturuldu")
        else:
            print(f"  ⏭️  {pt['name']} zaten var")
    
    # 0.1 Product Types - Yeni track_type yapısı ile
    print("\n📋 0.1. PRODUCT TYPES")
    print("-"*60)
    
    # Product types artık migration ile yönetiliyor, bu bölüm mevcut tipleri korur
    product_types_count = await db.product_types.count_documents({})
    if product_types_count == 0:
        # Eğer hiç yoksa temel tipleri ekle
        product_types = [
            {"id": 1, "code": "ZIYNET_QUARTER", "name": "Ziynet Çeyrek", "is_gold_based": True, "track_type": "FIFO", "fixed_weight": 1.75, "unit": "PIECE", "group": "SARRAFIYE"},
            {"id": 12, "code": "GOLD_RING", "name": "Altın Yüzük", "is_gold_based": True, "track_type": "UNIQUE", "fixed_weight": None, "unit": "GRAM", "group": "TAKI"},
        ]
        for pt in product_types:
            existing = await db.product_types.find_one({"id": pt["id"]})
            if not existing:
                await db.product_types.insert_one(pt)
                print(f"  ✅ {pt['name']} oluşturuldu")
            else:
                print(f"  ⏭️  {pt['name']} zaten var")
    else:
        print(f"  ✅ Product types zaten mevcut ({product_types_count} adet)")
    
    # 1. Users
    print("\n📋 1. USERS")
    print("-"*60)
    
    users = [
        {
            "id": "USER-ADMIN-001",
            "username": "admin",
            "email": "admin@kuyumcu.com",
            "password": bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
            "name": "Admin User",
            "role": "ADMIN",
            "is_active": True,
            "status": "ACTIVE",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "USER-DEMO-001",
            "username": "demo",
            "email": "demo@kuyumcu.com",
            "password": bcrypt.hashpw("demo123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
            "name": "Demo User",
            "role": "SALES",
            "is_active": True,
            "status": "ACTIVE",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    for user in users:
        await safe_insert_one(db.users, user, 'email')
    
    # 2. Parties
    print("\n📋 2. PARTIES")
    print("-"*60)
    
    parties = [
        {
            "id": "PARTY-SUPPLIER-001",
            "name": "Altın Tedarik A.Ş.",
            "code": "ALTIN-TED-001",
            "party_type_id": 2,  # SUPPLIER
            "email": "info@altintedarik.com",
            "phone": "02121234567",
            "tax_number": "1234567890",
            "is_active": True,
            "notes": "Ana altın tedarikçimiz",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "PARTY-CUSTOMER-001",
            "name": "Ahmet Yılmaz",
            "code": "AHMET-001",
            "party_type_id": 1,  # CUSTOMER
            "email": "ahmet@example.com",
            "phone": "05551234567",
            "tax_number": "11122233344",
            "is_active": True,
            "notes": "VIP müşteri",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "PARTY-CUSTOMER-002",
            "name": "Ayşe Demir",
            "code": "AYSE-002",
            "party_type_id": 1,  # CUSTOMER
            "email": "ayse@example.com",
            "phone": "05559876543",
            "tax_number": "55566677788",
            "is_active": True,
            "notes": "Düzenli müşteri",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    for party in parties:
        await safe_insert_one(db.parties, party)
    
    # 3. Karats
    print("\n📋 3. KARATS")
    print("-"*60)
    
    karats = [
        {
            "id": "KARAT-24",
            "karat": "24K",
            "fineness": 0.995,
            "description": "24 ayar altın",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "KARAT-22",
            "karat": "22K",
            "fineness": 0.916,
            "description": "22 ayar altın",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "KARAT-18",
            "karat": "18K",
            "fineness": 0.750,
            "description": "18 ayar altın",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "KARAT-14",
            "karat": "14K",
            "fineness": 0.585,
            "description": "14 ayar altın",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    for karat in karats:
        await safe_insert_one(db.karats, karat)
    
    # 4. Products
    print("\n📋 4. PRODUCTS (IN_STOCK)")
    print("-"*60)
    
    products = [
        {
            "id": "PROD-BILEZIK-001",
            "barcode": "BLZ001",
            "name": "Altın Bilezik 22K",
            "product_type_code": "GOLD_JEWELRY",
            "product_type_id": 1,
            "karat_id": "KARAT-22",
            "fineness": 0.916,
            "weight_gram": 25.50,
            "labor_type_code": "PER_GRAM",
            "labor_has_value": 0.5,
            "material_has_cost": 23.358,
            "labor_has_cost": 12.75,
            "total_cost_has": 36.108,
            "sale_has_value": 42.00,
            "stock_status_id": 1,
            "is_active": True,
            "notes": "Zarif tasarım bilezik",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "PROD-BILEZIK-002",
            "barcode": "BLZ002",
            "name": "Altın Bilezik 18K İnce",
            "product_type_code": "GOLD_JEWELRY",
            "product_type_id": 1,
            "karat_id": "KARAT-18",
            "fineness": 0.750,
            "weight_gram": 12.00,
            "labor_type_code": "PER_GRAM",
            "labor_has_value": 0.6,
            "material_has_cost": 9.00,
            "labor_has_cost": 7.20,
            "total_cost_has": 16.20,
            "sale_has_value": 19.00,
            "stock_status_id": 1,
            "is_active": True,
            "notes": "İnce bilezik",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "PROD-KOLYE-001",
            "barcode": "KLY001",
            "name": "Altın Kolye 18K",
            "product_type_code": "GOLD_JEWELRY",
            "product_type_id": 1,
            "karat_id": "KARAT-18",
            "fineness": 0.750,
            "weight_gram": 15.00,
            "labor_type_code": "PER_GRAM",
            "labor_has_value": 0.6,
            "material_has_cost": 11.25,
            "labor_has_cost": 9.00,
            "total_cost_has": 20.25,
            "sale_has_value": 24.00,
            "stock_status_id": 1,
            "is_active": True,
            "notes": "İnce zincir kolye",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "PROD-YUZUK-001",
            "barcode": "YZK001",
            "name": "Altın Yüzük 14K",
            "product_type_code": "GOLD_JEWELRY",
            "product_type_id": 1,
            "karat_id": "KARAT-14",
            "fineness": 0.585,
            "weight_gram": 5.50,
            "labor_type_code": "PER_GRAM",
            "labor_has_value": 0.7,
            "material_has_cost": 3.2175,
            "labor_has_cost": 3.85,
            "total_cost_has": 7.0675,
            "sale_has_value": 9.00,
            "stock_status_id": 1,
            "is_active": True,
            "notes": "Modern tasarım",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "PROD-YUZUK-002",
            "barcode": "YZK002",
            "name": "Altın Yüzük 18K Tek Taş",
            "product_type_code": "GOLD_JEWELRY",
            "product_type_id": 1,
            "karat_id": "KARAT-18",
            "fineness": 0.750,
            "weight_gram": 4.00,
            "labor_type_code": "PER_GRAM",
            "labor_has_value": 0.8,
            "material_has_cost": 3.00,
            "labor_has_cost": 3.20,
            "total_cost_has": 6.20,
            "sale_has_value": 8.00,
            "stock_status_id": 1,
            "is_active": True,
            "notes": "Tek taş yüzük",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    for product in products:
        await safe_insert_one(db.products, product)
    
    print("\n" + "="*60)
    print("✅ SEED DATA BAŞARIYLA İNİTİALİZE EDİLDİ!")
    print("="*60)
    print("\n📊 ÖZET:")
    print(f"   - Users: {len(users)} (admin & demo)")
    print(f"   - Parties: {len(parties)} (1 tedarikçi, 2 müşteri)")
    print(f"   - Karats: {len(karats)} (24K, 22K, 18K, 14K)")
    print(f"   - Products: {len(products)} (IN_STOCK)")
    print("\n🔑 GİRİŞ BİLGİLERİ:")
    print("   admin@kuyumcu.com / admin123")
    print("   demo@kuyumcu.com / demo123")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(init_seed_data())

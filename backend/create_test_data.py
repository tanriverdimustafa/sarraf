"""
Transaction V2 Test Data Generator
Kapsamlı test verileri oluşturur
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime, timezone
import bcrypt

load_dotenv()

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
DB_NAME = os.environ.get('DB_NAME', 'jewelry_system')

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

async def create_test_data():
    print("🚀 Test Verileri Oluşturuluyor...")
    print("="*60)
    
    # 1. Users
    print("\n📋 1. USERS (Kullanıcılar)")
    print("-"*60)
    
    users = [
        {
            "id": "USER-ADMIN-001",
            "email": "admin@kuyumcu.com",
            "password": bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
            "name": "Admin User",
            "role": "ADMIN",
            "is_active": True,
            "status": "ACTIVE",  # Backend expects 'status' field
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "USER-DEMO-001",
            "email": "demo@kuyumcu.com",
            "password": bcrypt.hashpw("demo123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
            "name": "Demo User",
            "role": "USER",
            "is_active": True,
            "status": "ACTIVE",  # Backend expects 'status' field
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.users.delete_many({})
    result = await db.users.insert_many(users)
    print(f"✅ {len(result.inserted_ids)} kullanıcı oluşturuldu")
    print(f"   - admin@kuyumcu.com / admin123 (ADMIN)")
    print(f"   - demo@kuyumcu.com / demo123 (USER)")
    
    # 2. Parties
    print("\n📋 2. PARTIES (Müşteriler & Tedarikçiler)")
    print("-"*60)
    
    parties = [
        {
            "id": "PARTY-SUPPLIER-001",
            "name": "Altın Tedarik A.Ş.",
            "type_id": 1,  # Supplier
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
            "type_id": 2,  # Customer
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
            "type_id": 2,  # Customer
            "email": "ayse@example.com",
            "phone": "05559876543",
            "tax_number": "55566677788",
            "is_active": True,
            "notes": "Düzenli müşteri",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "PARTY-CUSTOMER-003",
            "name": "Mehmet Kaya",
            "type_id": 2,  # Customer
            "email": "mehmet@example.com",
            "phone": "05551112233",
            "is_active": True,
            "notes": "Yeni müşteri",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.parties.delete_many({})
    result = await db.parties.insert_many(parties)
    print(f"✅ {len(result.inserted_ids)} party oluşturuldu")
    print(f"   - 1 Tedarikçi (Altın Tedarik A.Ş.)")
    print(f"   - 3 Müşteri (Ahmet, Ayşe, Mehmet)")
    
    # 3. Karats
    print("\n📋 3. KARATS (Ayar Bilgileri)")
    print("-"*60)
    
    karats = [
        {
            "id": "KARAT-24",
            "karat": "24K",
            "fineness": 0.995,
            "description": "24 ayar altın - En saf form",
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
            "description": "18 ayar altın - Yaygın kullanım",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "KARAT-14",
            "karat": "14K",
            "fineness": 0.585,
            "description": "14 ayar altın - Dayanıklı",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.karats.delete_many({})
    result = await db.karats.insert_many(karats)
    print(f"✅ {len(result.inserted_ids)} karat bilgisi oluşturuldu")
    print(f"   - 24K (0.995), 22K (0.916), 18K (0.750), 14K (0.585)")
    
    # 4. Products
    print("\n📋 4. PRODUCTS (Altın Ürünleri)")
    print("-"*60)
    
    products = [
        {
            "id": "PROD-BILEZIK-001",
            "barcode": "BLZ001",
            "name": "Altın Bilezik 22K",
            "product_type_code": "GOLD_JEWELRY",
            "karat_id": "KARAT-22",
            "fineness": 0.916,
            "weight_gram": 25.50,
            "labor_type_code": "PER_GRAM",
            "labor_has_value": 0.5,
            "material_has_cost": 23.358,  # 25.50 * 0.916
            "labor_has_cost": 12.75,  # 25.50 * 0.5
            "total_cost_has": 36.108,
            "sale_has_value": 42.00,
            "stock_status_id": 1,  # IN_STOCK
            "is_active": True,
            "notes": "Zarif tasarım 22 ayar bilezik",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "PROD-KOLYE-001",
            "barcode": "KLY001",
            "name": "Altın Kolye 18K",
            "product_type_code": "GOLD_JEWELRY",
            "karat_id": "KARAT-18",
            "fineness": 0.750,
            "weight_gram": 15.00,
            "labor_type_code": "PER_GRAM",
            "labor_has_value": 0.6,
            "material_has_cost": 11.25,  # 15.00 * 0.750
            "labor_has_cost": 9.00,  # 15.00 * 0.6
            "total_cost_has": 20.25,
            "sale_has_value": 24.00,
            "stock_status_id": 1,  # IN_STOCK
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
            "karat_id": "KARAT-14",
            "fineness": 0.585,
            "weight_gram": 5.50,
            "labor_type_code": "PER_GRAM",
            "labor_has_value": 0.7,
            "material_has_cost": 3.2175,  # 5.50 * 0.585
            "labor_has_cost": 3.85,  # 5.50 * 0.7
            "total_cost_has": 7.0675,
            "sale_has_value": 9.00,
            "stock_status_id": 1,  # IN_STOCK
            "is_active": True,
            "notes": "Modern tasarım yüzük",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "PROD-BILEZIK-002",
            "barcode": "BLZ002",
            "name": "Altın Bilezik 24K",
            "product_type_code": "GOLD_JEWELRY",
            "karat_id": "KARAT-24",
            "fineness": 0.995,
            "weight_gram": 50.00,
            "labor_type_code": "PER_GRAM",
            "labor_has_value": 0.3,
            "material_has_cost": 49.75,  # 50.00 * 0.995
            "labor_has_cost": 15.00,  # 50.00 * 0.3
            "total_cost_has": 64.75,
            "sale_has_value": 75.00,
            "stock_status_id": 1,  # IN_STOCK
            "is_active": True,
            "notes": "Ağır 24 ayar bilezik",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "PROD-KUPESI-001",
            "barcode": "KPE001",
            "name": "Altın Küpe 18K",
            "product_type_code": "GOLD_JEWELRY",
            "karat_id": "KARAT-18",
            "fineness": 0.750,
            "weight_gram": 8.00,
            "labor_type_code": "PER_GRAM",
            "labor_has_value": 0.8,
            "material_has_cost": 6.00,  # 8.00 * 0.750
            "labor_has_cost": 6.40,  # 8.00 * 0.8
            "total_cost_has": 12.40,
            "sale_has_value": 15.00,
            "stock_status_id": 1,  # IN_STOCK
            "is_active": True,
            "notes": "Zarif küpe çifti",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.products.delete_many({})
    result = await db.products.insert_many(products)
    print(f"✅ {len(result.inserted_ids)} ürün oluşturuldu")
    print(f"   - Bilezikler (22K, 24K)")
    print(f"   - Kolye (18K)")
    print(f"   - Yüzük (14K)")
    print(f"   - Küpe (18K)")
    print(f"   Tümü IN_STOCK durumunda")
    
    print("\n" + "="*60)
    print("✅ TÜM TEST VERİLERİ BAŞARIYLA OLUŞTURULDU!")
    print("="*60)
    print("\n📊 ÖZET:")
    print(f"   - 2 Kullanıcı (admin & demo)")
    print(f"   - 4 Party (1 tedarikçi, 3 müşteri)")
    print(f"   - 4 Karat bilgisi (24K, 22K, 18K, 14K)")
    print(f"   - 5 Ürün (tümü IN_STOCK)")
    print("\n🔑 GİRİŞ BİLGİLERİ:")
    print(f"   Admin: admin@kuyumcu.com / admin123")
    print(f"   Demo:  demo@kuyumcu.com / demo123")
    print("\n💡 TRANSACTION TEST ETMİYE HAZIR!")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(create_test_data())

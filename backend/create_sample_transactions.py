"""
Sample Transaction Creator for Transaction V2 Module
Her transaction tipinden örnek oluşturur
"""

import asyncio
import sys
sys.path.append('/app/backend')

from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime, timezone, timedelta

load_dotenv()

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
DB_NAME = os.environ.get('DB_NAME', 'jewelry_system')

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

async def create_sample_transactions():
    print("🎯 Örnek Transaction'lar Oluşturuluyor...")
    print("="*60)
    
    # Get price snapshot (latest)
    snapshot = await db.price_snapshots.find_one(sort=[("created_at", -1)])
    if not snapshot:
        print("❌ Price snapshot bulunamadı. Önce init_financial_v2.py çalıştırın")
        return
    
    now = datetime.now(timezone.utc)
    
    # 1. PURCHASE Transaction
    print("\n📋 1. PURCHASE Transaction (Alış)")
    print("-"*60)
    
    purchase_tx = {
        "code": f"TX-{now.strftime('%Y%m%d')}-PURCH-001",
        "type_code": "PURCHASE",
        "party_id": "PARTY-SUPPLIER-001",
        "counterparty_id": None,
        "transaction_date": now,
        "created_at": now,
        "updated_at": now,
        "created_by": "USER-ADMIN-001",
        "status": "COMPLETED",
        "total_has_amount": 100.00,  # POSITIVE (IN)
        "currency": "TRY",
        "total_amount_currency": 60000.00,
        "price_snapshot_id": snapshot["_id"],
        "payment_method_code": "BANK_TRANSFER",
        "commission_amount_currency": 0.0,
        "commission_has_amount": 0.0,
        "lines": [
            {
                "line_no": 1,
                "line_kind": "INVENTORY",
                "product_id": None,
                "sku": "TEST-GOLD-001",
                "product_type_code": "GOLD",
                "karat_id": "KARAT-24",
                "fineness": 0.995,
                "weight_gram": 100.0,
                "labor_type_code": "PER_GRAM",
                "labor_has_value": 0.1,
                "material_has": 99.5,
                "labor_has": 10.0,
                "line_total_has": 100.00,
                "quantity": 1,
                "unit_price_currency": 60000.00,
                "line_amount_currency": 60000.00,
                "referenced_tx_id": None,
                "referenced_line_id": None,
                "note": "24 ayar külçe altın alımı",
                "meta": {}
            }
        ],
        "reconciled": False,
        "reconciled_with": [],
        "reconciled_at": None,
        "reconciled_by": None,
        "notes": "Test amaçlı alış işlemi - Tedarikçiden külçe altın",
        "meta": {},
        "version": 1,
        "idempotency_key": "sample-purchase-001"
    }
    
    result = await db.financial_transactions.insert_one(purchase_tx)
    print(f"✅ PURCHASE transaction oluşturuldu: {purchase_tx['code']}")
    print(f"   Party: Altın Tedarik A.Ş.")
    print(f"   Amount: 100.00 HAS (IN)")
    
    # 2. PAYMENT Transaction
    print("\n📋 2. PAYMENT Transaction (Ödeme)")
    print("-"*60)
    
    payment_tx = {
        "code": f"TX-{now.strftime('%Y%m%d')}-PAY-001",
        "type_code": "PAYMENT",
        "party_id": "PARTY-SUPPLIER-001",
        "counterparty_id": None,
        "transaction_date": now,
        "created_at": now,
        "updated_at": now,
        "created_by": "USER-ADMIN-001",
        "status": "COMPLETED",
        "total_has_amount": -50.00,  # NEGATIVE (OUT)
        "currency": "TRY",
        "total_amount_currency": 30000.00,
        "price_snapshot_id": snapshot["_id"],
        "payment_method_code": "CASH",
        "commission_amount_currency": 0.0,
        "commission_has_amount": 0.0,
        "lines": [
            {
                "line_no": 1,
                "line_kind": "PAYMENT",
                "product_id": None,
                "sku": None,
                "product_type_code": None,
                "karat_id": None,
                "fineness": None,
                "weight_gram": None,
                "labor_type_code": None,
                "labor_has_value": None,
                "material_has": 0.0,
                "labor_has": 0.0,
                "line_total_has": 50.00,
                "quantity": 1,
                "unit_price_currency": 30000.00,
                "line_amount_currency": 30000.00,
                "referenced_tx_id": None,
                "referenced_line_id": None,
                "note": "Tedarikçiye nakit ödeme",
                "meta": {"payment_currency": "TRY", "payment_amount": 30000.00}
            }
        ],
        "reconciled": False,
        "reconciled_with": [],
        "reconciled_at": None,
        "reconciled_by": None,
        "notes": "Test amaçlı ödeme - Tedarikçiye borç ödemesi",
        "meta": {"payment_direction": "OUT"},
        "version": 1,
        "idempotency_key": "sample-payment-001"
    }
    
    result = await db.financial_transactions.insert_one(payment_tx)
    print(f"✅ PAYMENT transaction oluşturuldu: {payment_tx['code']}")
    print(f"   Party: Altın Tedarik A.Ş.")
    print(f"   Amount: -50.00 HAS (OUT)")
    
    # 3. RECEIPT Transaction
    print("\n📋 3. RECEIPT Transaction (Tahsilat)")
    print("-"*60)
    
    receipt_tx = {
        "code": f"TX-{now.strftime('%Y%m%d')}-REC-001",
        "type_code": "RECEIPT",
        "party_id": "PARTY-CUSTOMER-001",
        "counterparty_id": None,
        "transaction_date": now,
        "created_at": now,
        "updated_at": now,
        "created_by": "USER-DEMO-001",
        "status": "COMPLETED",
        "total_has_amount": 15.00,  # POSITIVE (IN)
        "currency": "TRY",
        "total_amount_currency": 9000.00,
        "price_snapshot_id": snapshot["_id"],
        "payment_method_code": "BANK_TRANSFER",
        "commission_amount_currency": 0.0,
        "commission_has_amount": 0.0,
        "lines": [
            {
                "line_no": 1,
                "line_kind": "PAYMENT",
                "product_id": None,
                "sku": None,
                "product_type_code": None,
                "karat_id": None,
                "fineness": None,
                "weight_gram": None,
                "labor_type_code": None,
                "labor_has_value": None,
                "material_has": 0.0,
                "labor_has": 0.0,
                "line_total_has": 15.00,
                "quantity": 1,
                "unit_price_currency": 9000.00,
                "line_amount_currency": 9000.00,
                "referenced_tx_id": None,
                "referenced_line_id": None,
                "note": "Müşteriden tahsilat alındı",
                "meta": {"receipt_currency": "TRY", "receipt_amount": 9000.00}
            }
        ],
        "reconciled": False,
        "reconciled_with": [],
        "reconciled_at": None,
        "reconciled_by": None,
        "notes": "Test amaçlı tahsilat - Ahmet Yılmaz'dan ödeme",
        "meta": {"receipt_direction": "IN"},
        "version": 1,
        "idempotency_key": "sample-receipt-001"
    }
    
    result = await db.financial_transactions.insert_one(receipt_tx)
    print(f"✅ RECEIPT transaction oluşturuldu: {receipt_tx['code']}")
    print(f"   Party: Ahmet Yılmaz")
    print(f"   Amount: 15.00 HAS (IN)")
    
    # 4. EXCHANGE Transaction
    print("\n📋 4. EXCHANGE Transaction (Döviz)")
    print("-"*60)
    
    exchange_tx = {
        "code": f"TX-{now.strftime('%Y%m%d')}-EXC-001",
        "type_code": "EXCHANGE",
        "party_id": None,
        "counterparty_id": None,
        "transaction_date": now,
        "created_at": now,
        "updated_at": now,
        "created_by": "USER-ADMIN-001",
        "status": "COMPLETED",
        "total_has_amount": 0.5,  # NET (spread)
        "currency": None,
        "total_amount_currency": None,
        "price_snapshot_id": snapshot["_id"],
        "payment_method_code": None,
        "commission_amount_currency": 0.0,
        "commission_has_amount": 0.0,
        "lines": [
            {
                "line_no": 1,
                "line_kind": "FX",
                "product_id": None,
                "sku": None,
                "product_type_code": None,
                "karat_id": None,
                "fineness": None,
                "weight_gram": None,
                "labor_type_code": None,
                "labor_has_value": None,
                "material_has": 0.0,
                "labor_has": 0.0,
                "line_total_has": -10.0,  # OUT
                "quantity": 1,
                "unit_price_currency": -1000.00,
                "line_amount_currency": -1000.00,
                "referenced_tx_id": None,
                "referenced_line_id": None,
                "note": "USD 1000.00 verilen",
                "meta": {"currency": "USD", "amount": 1000.00, "direction": "OUT"}
            },
            {
                "line_no": 2,
                "line_kind": "FX",
                "product_id": None,
                "sku": None,
                "product_type_code": None,
                "karat_id": None,
                "fineness": None,
                "weight_gram": None,
                "labor_type_code": None,
                "labor_has_value": None,
                "material_has": 0.0,
                "labor_has": 0.0,
                "line_total_has": 10.5,  # IN
                "quantity": 1,
                "unit_price_currency": 35000.00,
                "line_amount_currency": 35000.00,
                "referenced_tx_id": None,
                "referenced_line_id": None,
                "note": "TRY 35000.00 alınan",
                "meta": {"currency": "TRY", "amount": 35000.00, "direction": "IN"}
            }
        ],
        "reconciled": False,
        "reconciled_with": [],
        "reconciled_at": None,
        "reconciled_by": None,
        "notes": "Test amaçlı döviz işlemi - USD/TRY exchange",
        "meta": {
            "from_currency": "USD",
            "to_currency": "TRY",
            "from_amount": 1000.00,
            "to_amount": 35000.00,
            "fx_rate": 35.00,
            "net_has": 0.5
        },
        "version": 1,
        "idempotency_key": "sample-exchange-001"
    }
    
    result = await db.financial_transactions.insert_one(exchange_tx)
    print(f"✅ EXCHANGE transaction oluşturuldu: {exchange_tx['code']}")
    print(f"   Exchange: 1000 USD → 35000 TRY")
    print(f"   Net HAS: 0.5 (spread)")
    
    # 5. HURDA Transaction
    print("\n📋 5. HURDA Transaction (Hurda Altın)")
    print("-"*60)
    
    hurda_tx = {
        "code": f"TX-{now.strftime('%Y%m%d')}-HRD-001",
        "type_code": "HURDA",
        "party_id": "PARTY-CUSTOMER-002",
        "counterparty_id": None,
        "transaction_date": now,
        "created_at": now,
        "updated_at": now,
        "created_by": "USER-DEMO-001",
        "status": "COMPLETED",
        "total_has_amount": -20.0,  # NEGATIVE (OUT - payment)
        "currency": None,
        "total_amount_currency": None,
        "price_snapshot_id": snapshot["_id"],
        "payment_method_code": "GOLD_SCRAP",
        "commission_amount_currency": 0.0,
        "commission_has_amount": 0.0,
        "lines": [
            {
                "line_no": 1,
                "line_kind": "INVENTORY",
                "product_id": None,
                "sku": None,
                "product_type_code": "GOLD_SCRAP",
                "karat_id": "KARAT-18",
                "fineness": 0.750,
                "weight_gram": 15.0,
                "labor_type_code": None,
                "labor_has_value": None,
                "material_has": 11.25,
                "labor_has": 0.0,
                "line_total_has": 11.25,
                "quantity": 1,
                "unit_price_currency": None,
                "line_amount_currency": None,
                "referenced_tx_id": None,
                "referenced_line_id": None,
                "note": "Hurda 18k - 15.0gr",
                "meta": {"scrap_type": "broken_jewelry", "fineness": 0.750}
            },
            {
                "line_no": 2,
                "line_kind": "INVENTORY",
                "product_id": None,
                "sku": None,
                "product_type_code": "GOLD_SCRAP",
                "karat_id": "KARAT-14",
                "fineness": 0.585,
                "weight_gram": 15.0,
                "labor_type_code": None,
                "labor_has_value": None,
                "material_has": 8.775,
                "labor_has": 0.0,
                "line_total_has": 8.775,
                "quantity": 1,
                "unit_price_currency": None,
                "line_amount_currency": None,
                "referenced_tx_id": None,
                "referenced_line_id": None,
                "note": "Hurda 14k - 15.0gr",
                "meta": {"scrap_type": "old_jewelry", "fineness": 0.585}
            }
        ],
        "reconciled": False,
        "reconciled_with": [],
        "reconciled_at": None,
        "reconciled_by": None,
        "notes": "Test amaçlı hurda altın işlemi - Ayşe Demir",
        "meta": {
            "total_scrap_has": 20.025,
            "total_weight_gram": 30.0,
            "equivalent_tl": 12000.00,
            "scrap_items_count": 2
        },
        "version": 1,
        "idempotency_key": "sample-hurda-001"
    }
    
    result = await db.financial_transactions.insert_one(hurda_tx)
    print(f"✅ HURDA transaction oluşturuldu: {hurda_tx['code']}")
    print(f"   Party: Ayşe Demir")
    print(f"   Amount: -20.0 HAS (OUT - hurda ile ödeme)")
    print(f"   Total Weight: 30gr (18K + 14K)")
    
    print("\n" + "="*60)
    print("✅ TÜM ÖRNEK TRANSACTION'LAR OLUŞTURULDU!")
    print("="*60)
    print("\n📊 ÖZET:")
    print(f"   ✅ 1 PURCHASE (Alış - IN)")
    print(f"   ✅ 1 PAYMENT (Ödeme - OUT)")
    print(f"   ✅ 1 RECEIPT (Tahsilat - IN)")
    print(f"   ✅ 1 EXCHANGE (Döviz - NET)")
    print(f"   ✅ 1 HURDA (Hurda Altın - OUT)")
    print("\n💡 Not: SALE transaction için IN_STOCK ürünleri kullanabilirsiniz:")
    print("   - PROD-BILEZIK-001 (22K)")
    print("   - PROD-KOLYE-001 (18K)")
    print("   - PROD-YUZUK-001 (14K)")
    print("   - PROD-KUPESI-001 (18K)")
    print("   - PROD-BILEZIK-002 (24K)")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(create_sample_transactions())

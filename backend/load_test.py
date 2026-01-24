"""
Load Test Script
================
Sisteme yük bindirip performans ölçer.

Kullanım:
    python load_test.py

Aşamalar:
    A: 100 Cari oluştur
    B: 500 Ürün oluştur
    C: 1,000 Transaction oluştur
    D: 5,000 Transaction oluştur
    E: 10,000 Transaction oluştur
"""

import asyncio
import time
import random
import uuid
import httpx
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os

BASE_URL = "http://localhost:8001/api"

# Test verileri için prefix
TEST_PREFIX = "LOAD_TEST_"

# Ürün tipleri (ID'ler)
PRODUCT_TYPES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
KARATS = [
    {"id": 1, "fineness": 0.916},  # 22K
    {"id": 2, "fineness": 0.750},  # 18K
    {"id": 3, "fineness": 0.585},  # 14K
    {"id": 4, "fineness": 0.995},  # 24K
]


async def measure_api(client, endpoint, headers, iterations=3):
    """Bir endpoint'in ortalama response süresini ölç"""
    times = []
    for _ in range(iterations):
        start = time.perf_counter()
        try:
            resp = await client.get(f"{BASE_URL}{endpoint}", headers=headers, timeout=60.0)
            elapsed = (time.perf_counter() - start) * 1000
            times.append(elapsed)
        except Exception as e:
            print(f"Error: {e}")
            times.append(-1)
    
    valid_times = [t for t in times if t > 0]
    if valid_times:
        return round(sum(valid_times) / len(valid_times), 2)
    return -1


async def get_counts(db):
    """Mevcut kayıt sayılarını al"""
    return {
        'parties': await db.parties.count_documents({}),
        'products': await db.products.count_documents({}),
        'transactions': await db.financial_transactions.count_documents({}),
        'unified_ledger': await db.unified_ledger.count_documents({})
    }


async def measure_all_endpoints(client, headers, label=""):
    """Tüm endpoint'leri ölç"""
    endpoints = [
        ("/parties", "Cariler"),
        ("/products", "Ürünler"),
        ("/financial-transactions", "İşlemler"),
        ("/reports/profit-loss?start_date=2024-01-01&end_date=2025-12-31", "Kar/Zarar"),
        ("/unified-ledger", "Muhasebe"),
        ("/stock/summary", "Stok"),
        ("/cash-registers/summary", "Kasa"),
    ]
    
    results = {}
    for endpoint, name in endpoints:
        ms = await measure_api(client, endpoint, headers)
        results[name] = ms
    
    return results


async def create_parties(db, count):
    """Test carileri oluştur"""
    parties = []
    now = datetime.utcnow().isoformat()
    
    for i in range(count):
        party_type = 2 if i < count // 2 else 3  # Yarısı tedarikçi, yarısı müşteri
        party = {
            "id": str(uuid.uuid4()),
            "name": f"{TEST_PREFIX}Cari_{i+1}",
            "party_type_id": party_type,
            "contact_info": {"phone": f"555{random.randint(1000000, 9999999)}"},
            "has_balance": 0.0,
            "try_balance": 0.0,
            "usd_balance": 0.0,
            "eur_balance": 0.0,
            "is_active": True,
            "created_at": now,
            "updated_at": now
        }
        parties.append(party)
    
    if parties:
        await db.parties.insert_many(parties)
    
    return len(parties)


async def create_products(db, count):
    """Test ürünleri oluştur"""
    products = []
    now = datetime.utcnow().isoformat()
    
    for i in range(count):
        karat = random.choice(KARATS)
        weight = round(random.uniform(1, 100), 2)
        product_type = random.choice(PRODUCT_TYPES)
        
        product = {
            "id": str(uuid.uuid4()),
            "barcode": f"{TEST_PREFIX}BC{i+1:06d}",
            "name": f"{TEST_PREFIX}Ürün_{i+1}",
            "product_type_id": product_type,
            "karat_id": karat["id"],
            "fineness": karat["fineness"],
            "weight_gram": weight,
            "material_has_cost": round(weight * karat["fineness"], 4),
            "labor_has_cost": round(random.uniform(0.1, 0.5), 4),
            "total_cost_has": round(weight * karat["fineness"] + random.uniform(0.1, 0.5), 4),
            "sale_has_value": round(weight * karat["fineness"] * 1.1, 4),
            "stock_status_id": 1,  # IN_STOCK
            "is_active": True,
            "created_at": now,
            "updated_at": now
        }
        products.append(product)
    
    if products:
        await db.products.insert_many(products)
    
    return len(products)


async def create_transactions(db, count, party_ids, start_counter=0):
    """Test transaction'ları oluştur"""
    transactions = []
    ledger_entries = []
    now = datetime.utcnow()
    
    # Transaction dağılımı
    purchase_count = int(count * 0.4)
    sale_count = int(count * 0.4)
    payment_count = int(count * 0.1)
    receipt_count = count - purchase_count - sale_count - payment_count
    
    type_distribution = (
        [("PURCHASE", purchase_count)] +
        [("SALE", sale_count)] +
        [("PAYMENT", payment_count)] +
        [("RECEIPT", receipt_count)]
    )
    
    tx_counter = start_counter
    for type_code, type_count in type_distribution:
        for i in range(type_count):
            tx_counter += 1
            tx_date = now - timedelta(days=random.randint(0, 365))
            party_id = random.choice(party_ids)
            amount = round(random.uniform(1000, 100000), 2)
            has_amount = round(random.uniform(1, 50), 4)
            
            tx = {
                "id": str(uuid.uuid4()),
                "code": f"{TEST_PREFIX}TX{tx_counter:08d}",
                "type_code": type_code,
                "party_id": party_id,
                "transaction_date": tx_date.isoformat(),
                "currency": "TRY",
                "total_amount_currency": amount,
                "total_has": has_amount,
                "payment_method_code": random.choice(["CASH_TRY", "BANK_TRY"]),
                "status": "COMPLETED",
                "lines": [],
                "notes": f"Load test transaction {tx_counter}",
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
                "created_by": "load_test",
                "version": 1
            }
            transactions.append(tx)
            
            # Unified ledger entry
            ledger = {
                "id": str(uuid.uuid4()),
                "type": type_code,
                "transaction_date": tx_date.isoformat(),
                "party_id": party_id,
                "party_type": "SUPPLIER" if type_code in ["PURCHASE", "PAYMENT"] else "CUSTOMER",
                "reference_id": tx["id"],
                "reference_code": tx["code"],
                "description": f"Load test {type_code}",
                "debit_has": has_amount if type_code in ["PURCHASE", "RECEIPT"] else 0,
                "credit_has": has_amount if type_code in ["SALE", "PAYMENT"] else 0,
                "debit_try": amount if type_code in ["SALE", "PAYMENT"] else 0,
                "credit_try": amount if type_code in ["PURCHASE", "RECEIPT"] else 0,
                "created_at": now.isoformat()
            }
            ledger_entries.append(ledger)
    
    # Batch insert
    batch_size = 1000
    for i in range(0, len(transactions), batch_size):
        batch = transactions[i:i+batch_size]
        await db.financial_transactions.insert_many(batch)
    
    for i in range(0, len(ledger_entries), batch_size):
        batch = ledger_entries[i:i+batch_size]
        await db.unified_ledger.insert_many(batch)
    
    return len(transactions), tx_counter


async def concurrent_test(client, headers, concurrent_requests):
    """Eşzamanlı istek testi"""
    endpoint = f"{BASE_URL}/financial-transactions"
    
    async def single_request():
        start = time.perf_counter()
        try:
            resp = await client.get(endpoint, headers=headers, timeout=60.0)
            return (time.perf_counter() - start) * 1000, resp.status_code == 200
        except:
            return -1, False
    
    tasks = [single_request() for _ in range(concurrent_requests)]
    results = await asyncio.gather(*tasks)
    
    times = [r[0] for r in results if r[0] > 0]
    success_count = sum(1 for r in results if r[1])
    
    if times:
        return {
            'avg': round(sum(times) / len(times), 2),
            'max': round(max(times), 2),
            'min': round(min(times), 2),
            'success': success_count,
            'total': concurrent_requests,
            'error_rate': round((concurrent_requests - success_count) / concurrent_requests * 100, 1)
        }
    return None


async def run_load_test():
    """Ana load test fonksiyonu"""
    print("=" * 70)
    print("🚀 LOAD TEST BAŞLIYOR")
    print("=" * 70)
    
    # MongoDB bağlantısı
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    mongo_client = AsyncIOMotorClient(mongo_url)
    db = mongo_client['kuyumcu_db']
    
    # HTTP client
    async with httpx.AsyncClient() as client:
        # Login
        login_resp = await client.post(f"{BASE_URL}/auth/login", json={
            "email": "admin@kuyumcu.com",
            "password": "admin123"
        })
        token = login_resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Sonuçları sakla
        all_results = {}
        
        # ===================== BASELINE =====================
        print("\n📊 BASELINE ÖLÇÜMÜ...")
        counts = await get_counts(db)
        baseline = await measure_all_endpoints(client, headers)
        all_results['baseline'] = {'counts': counts, 'times': baseline}
        
        print(f"   Cariler: {counts['parties']}, Ürünler: {counts['products']}, "
              f"İşlemler: {counts['transactions']}")
        
        # ===================== AŞAMA A: 100 CARİ =====================
        print("\n🔄 AŞAMA A: 100 Cari oluşturuluyor...")
        created = await create_parties(db, 100)
        print(f"   ✅ {created} cari oluşturuldu")
        
        counts = await get_counts(db)
        times_a = await measure_all_endpoints(client, headers)
        all_results['phase_a'] = {'counts': counts, 'times': times_a}
        
        # Party ID'lerini al (transaction'lar için)
        party_cursor = db.parties.find({}, {"id": 1})
        party_ids = [p["id"] async for p in party_cursor]
        
        # ===================== AŞAMA B: 500 ÜRÜN =====================
        print("\n🔄 AŞAMA B: 500 Ürün oluşturuluyor...")
        created = await create_products(db, 500)
        print(f"   ✅ {created} ürün oluşturuldu")
        
        counts = await get_counts(db)
        times_b = await measure_all_endpoints(client, headers)
        all_results['phase_b'] = {'counts': counts, 'times': times_b}
        
        # ===================== AŞAMA C: 1,000 TRANSACTION =====================
        print("\n🔄 AŞAMA C: 1,000 Transaction oluşturuluyor...")
        created, tx_counter = await create_transactions(db, 1000, party_ids, 0)
        print(f"   ✅ {created} transaction oluşturuldu")
        
        counts = await get_counts(db)
        times_c = await measure_all_endpoints(client, headers)
        all_results['phase_c'] = {'counts': counts, 'times': times_c}
        
        # ===================== AŞAMA D: 5,000 TRANSACTION =====================
        print("\n🔄 AŞAMA D: 4,000 Transaction daha ekleniyor (toplam 5K)...")
        created, tx_counter = await create_transactions(db, 4000, party_ids, tx_counter)
        print(f"   ✅ {created} transaction oluşturuldu")
        
        counts = await get_counts(db)
        times_d = await measure_all_endpoints(client, headers)
        all_results['phase_d'] = {'counts': counts, 'times': times_d}
        
        # ===================== AŞAMA E: 10,000 TRANSACTION =====================
        print("\n🔄 AŞAMA E: 5,000 Transaction daha ekleniyor (toplam 10K)...")
        created, tx_counter = await create_transactions(db, 5000, party_ids, tx_counter)
        print(f"   ✅ {created} transaction oluşturuldu")
        
        counts = await get_counts(db)
        times_e = await measure_all_endpoints(client, headers)
        all_results['phase_e'] = {'counts': counts, 'times': times_e}
        
        # ===================== STRES TESTİ =====================
        print("\n🔥 STRES TESTİ (Eşzamanlı İstekler)...")
        stress_results = {}
        
        for concurrent in [10, 25, 50]:
            print(f"   Testing {concurrent} concurrent requests...")
            result = await concurrent_test(client, headers, concurrent)
            stress_results[concurrent] = result
            if result:
                print(f"   ✅ {concurrent} istek: avg={result['avg']}ms, "
                      f"max={result['max']}ms, hata=%{result['error_rate']}")
        
        all_results['stress'] = stress_results
        
        # ===================== RAPOR =====================
        print("\n")
        print("=" * 70)
        print("📊 LOAD TEST RAPORU")
        print("=" * 70)
        
        # 1. Veri sayıları
        print("\n📁 VERİ SAYILARI:")
        print("-" * 50)
        print(f"{'Aşama':<15} {'Cari':>10} {'Ürün':>10} {'İşlem':>10} {'Muhasebe':>10}")
        print("-" * 50)
        
        phases = [
            ('Baseline', 'baseline'),
            ('A (100 Cari)', 'phase_a'),
            ('B (500 Ürün)', 'phase_b'),
            ('C (1K TX)', 'phase_c'),
            ('D (5K TX)', 'phase_d'),
            ('E (10K TX)', 'phase_e'),
        ]
        
        for label, key in phases:
            c = all_results[key]['counts']
            print(f"{label:<15} {c['parties']:>10} {c['products']:>10} "
                  f"{c['transactions']:>10} {c['unified_ledger']:>10}")
        
        # 2. API response süreleri
        print("\n⏱️ API RESPONSE SÜRELERİ (ms):")
        print("-" * 80)
        endpoints = list(all_results['baseline']['times'].keys())
        header = f"{'Endpoint':<15}" + "".join(f"{p[0]:<12}" for p in phases)
        print(header)
        print("-" * 80)
        
        for endpoint in endpoints:
            row = f"{endpoint:<15}"
            for _, key in phases:
                ms = all_results[key]['times'].get(endpoint, -1)
                row += f"{ms:>10.1f}ms"
            print(row)
        
        # 3. Stres testi
        print("\n🔥 STRES TESTİ SONUÇLARI:")
        print("-" * 60)
        print(f"{'Eşzamanlı':>12} {'Ortalama':>12} {'Max':>12} {'Min':>12} {'Hata %':>10}")
        print("-" * 60)
        
        for concurrent, result in stress_results.items():
            if result:
                print(f"{concurrent:>12} {result['avg']:>10.1f}ms {result['max']:>10.1f}ms "
                      f"{result['min']:>10.1f}ms {result['error_rate']:>9.1f}%")
        
        # 4. Performans değerlendirmesi
        print("\n" + "=" * 70)
        print("📈 PERFORMANS DEĞERLENDİRMESİ")
        print("=" * 70)
        
        # 10K transaction ile en yavaş endpoint
        slowest = max(all_results['phase_e']['times'].items(), key=lambda x: x[1])
        fastest = min(all_results['phase_e']['times'].items(), key=lambda x: x[1])
        
        # Baseline vs 10K karşılaştırma
        print("\n📊 Baseline vs 10K Transaction Karşılaştırması:")
        for endpoint in endpoints:
            baseline_ms = all_results['baseline']['times'][endpoint]
            final_ms = all_results['phase_e']['times'][endpoint]
            change = ((final_ms - baseline_ms) / baseline_ms * 100) if baseline_ms > 0 else 0
            status = "✅" if final_ms < 200 else "⚠️" if final_ms < 500 else "❌"
            print(f"   {status} {endpoint:<15}: {baseline_ms:.1f}ms → {final_ms:.1f}ms ({change:+.1f}%)")
        
        # Sonuç
        max_time = max(all_results['phase_e']['times'].values())
        max_error_rate = max((r['error_rate'] for r in stress_results.values() if r), default=0)
        
        print("\n" + "=" * 70)
        if max_time < 200 and max_error_rate < 5:
            print("✅ SİSTEM DURUMU: PRODUCTION-READY")
            print("   10K+ transaction ile tüm API'lar 200ms altında yanıt veriyor.")
        elif max_time < 500 and max_error_rate < 10:
            print("🟡 SİSTEM DURUMU: KABUL EDİLEBİLİR")
            print("   Sistem çalışıyor ancak optimizasyon önerilir.")
        else:
            print("❌ SİSTEM DURUMU: SORUNLU")
            print("   Kritik performans sorunları tespit edildi.")
        print("=" * 70)
    
    mongo_client.close()
    print("\n✅ Load test tamamlandı!")


if __name__ == "__main__":
    asyncio.run(run_load_test())

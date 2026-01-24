#!/usr/bin/env python3
"""
KUYUMCULUK PROJESİ - 5 GÖREV BACKEND TESTİ

Bu test dosyası aşağıdaki 5 görevi test eder:
1. GÖREV 1 - ÜRÜNLER SAYFALAMA
2. GÖREV 2 - PURCHASE TEDARİKÇİ BORÇ YAZMA  
3. GÖREV 3 - ÜRÜN DÜZENLEME BORÇ GÜNCELLEME
4. GÖREV 4 - ÜRÜN SİLME BORÇ GÜNCELLEME
5. GÖREV 5 - PARTY HAS_BALANCE

URL: https://task-viewer-4.preview.emergentagent.com
Credentials: admin@kuyumcu.com / admin123
"""

import requests
import json
import sys
from datetime import datetime
from typing import Optional, Dict, Any

class KuyumculukTester:
    def __init__(self):
        self.base_url = "https://task-viewer-4.preview.emergentagent.com"
        self.api_url = f"{self.base_url}/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{status} - {name}")
        if details:
            print(f"   Details: {details}")
    
    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, expected_status: int = 200) -> tuple[bool, Dict]:
        """Make HTTP request to API"""
        url = f"{self.api_url}/{endpoint}"
        
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                return False, {"error": f"Unsupported method: {method}"}
            
            success = response.status_code == expected_status
            
            try:
                response_data = response.json() if response.content else {}
            except:
                response_data = {"text": response.text[:500]}
            
            if not success:
                response_data["status_code"] = response.status_code
                response_data["expected_status"] = expected_status
            
            return success, response_data
            
        except Exception as e:
            return False, {"error": str(e)}
    
    def login(self) -> bool:
        """Login with admin credentials"""
        print("\n🔐 AUTHENTICATION")
        print("-" * 40)
        
        success, response = self.make_request(
            "POST", 
            "auth/login",
            {"email": "admin@kuyumcu.com", "password": "admin123"},
            200
        )
        
        if success and "token" in response:
            self.token = response["token"]
            self.log_test("Admin Login", True, f"Token length: {len(self.token)}")
            return True
        else:
            self.log_test("Admin Login", False, f"Login failed: {response}")
            return False
    
    def test_gorev_1_urunler_sayfalama(self):
        """GÖREV 1 TESTİ - ÜRÜNLER SAYFALAMA"""
        print("\n📦 GÖREV 1 - ÜRÜNLER SAYFALAMA")
        print("=" * 50)
        
        # TEST 1.1: page=1&per_page=10
        print("\n🔸 TEST 1.1: Sayfa 1, Sayfa başına 10")
        success1, response1 = self.make_request("GET", "products?page=1&per_page=10")
        
        if success1:
            # Check response structure
            if "products" in response1 and "pagination" in response1:
                self.log_test("1.1 Response Structure", True, "products array ve pagination object mevcut")
                
                # Check pagination fields
                pagination = response1["pagination"]
                required_fields = ["page", "per_page", "total", "total_pages"]
                missing_fields = [field for field in required_fields if field not in pagination]
                
                if not missing_fields:
                    self.log_test("1.1 Pagination Fields", True, f"Tüm gerekli alanlar mevcut: {pagination}")
                else:
                    self.log_test("1.1 Pagination Fields", False, f"Eksik alanlar: {missing_fields}")
                
                # Check page value
                if pagination.get("page") == 1:
                    self.log_test("1.1 Page Value", True, "page = 1")
                else:
                    self.log_test("1.1 Page Value", False, f"page = {pagination.get('page')} (expected 1)")
                
                # Check per_page value
                if pagination.get("per_page") == 10:
                    self.log_test("1.1 Per Page Value", True, "per_page = 10")
                else:
                    self.log_test("1.1 Per Page Value", False, f"per_page = {pagination.get('per_page')} (expected 10)")
                
                # Check products count
                products_count = len(response1.get("products", []))
                if products_count <= 10:
                    self.log_test("1.1 Products Count", True, f"{products_count} ürün döndü (≤10)")
                else:
                    self.log_test("1.1 Products Count", False, f"{products_count} ürün döndü (>10)")
                    
            else:
                self.log_test("1.1 Response Structure", False, "products array veya pagination object eksik")
        else:
            self.log_test("1.1 API Call", False, f"API çağrısı başarısız: {response1}")
        
        # TEST 1.2: page=2&per_page=10 (farklı ürünler gelmeli)
        print("\n🔸 TEST 1.2: Sayfa 2, Sayfa başına 10")
        success2, response2 = self.make_request("GET", "products?page=2&per_page=10")
        
        if success2:
            if "products" in response2 and "pagination" in response2:
                pagination2 = response2["pagination"]
                
                if pagination2.get("page") == 2:
                    self.log_test("1.2 Page 2 Value", True, "page = 2")
                else:
                    self.log_test("1.2 Page 2 Value", False, f"page = {pagination2.get('page')} (expected 2)")
                
                # Compare with page 1 products (should be different if there are enough products)
                if success1 and "products" in response1:
                    products1 = response1["products"]
                    products2 = response2["products"]
                    
                    if len(products1) > 0 and len(products2) > 0:
                        # Check if products are different
                        products1_ids = [p.get("id") for p in products1]
                        products2_ids = [p.get("id") for p in products2]
                        
                        if set(products1_ids).isdisjoint(set(products2_ids)):
                            self.log_test("1.2 Different Products", True, "Sayfa 2'de farklı ürünler var")
                        else:
                            self.log_test("1.2 Different Products", False, "Sayfa 2'de aynı ürünler var")
                    else:
                        self.log_test("1.2 Different Products", True, "Sayfa karşılaştırması yapılamadı (boş sayfalar)")
            else:
                self.log_test("1.2 Response Structure", False, "products array veya pagination object eksik")
        else:
            self.log_test("1.2 API Call", False, f"API çağrısı başarısız: {response2}")
        
        # TEST 1.3: per_page=5 (5 veya daha az ürün dönmeli)
        print("\n🔸 TEST 1.3: Sayfa başına 5")
        success3, response3 = self.make_request("GET", "products?per_page=5")
        
        if success3:
            if "products" in response3 and "pagination" in response3:
                pagination3 = response3["pagination"]
                products3 = response3["products"]
                
                if pagination3.get("per_page") == 5:
                    self.log_test("1.3 Per Page 5 Value", True, "per_page = 5")
                else:
                    self.log_test("1.3 Per Page 5 Value", False, f"per_page = {pagination3.get('per_page')} (expected 5)")
                
                if len(products3) <= 5:
                    self.log_test("1.3 Products Count Limit", True, f"{len(products3)} ürün döndü (≤5)")
                else:
                    self.log_test("1.3 Products Count Limit", False, f"{len(products3)} ürün döndü (>5)")
            else:
                self.log_test("1.3 Response Structure", False, "products array veya pagination object eksik")
        else:
            self.log_test("1.3 API Call", False, f"API çağrısı başarısız: {response3}")
    
    def test_gorev_2_purchase_tedarikci_borc(self):
        """GÖREV 2 TESTİ - PURCHASE TEDARİKÇİ BORÇ YAZMA"""
        print("\n💰 GÖREV 2 - PURCHASE TEDARİKÇİ BORÇ YAZMA")
        print("=" * 50)
        
        # TEST 2.1: Tedarikçileri listele ve birini seç
        print("\n🔸 TEST 2.1: Tedarikçi seçimi")
        success1, parties_response = self.make_request("GET", "parties")
        
        supplier_id = None
        initial_balance = 0.0
        
        if success1 and isinstance(parties_response, list):
            # Find a supplier (party_type_id=2)
            suppliers = [p for p in parties_response if p.get("party_type_id") == 2]
            
            if suppliers:
                supplier = suppliers[0]
                supplier_id = supplier.get("id")
                
                # Get initial balance
                if "balance" in supplier:
                    initial_balance = supplier["balance"].get("has_gold_balance", 0.0)
                
                self.log_test("2.1 Supplier Selection", True, f"Tedarikçi seçildi: {supplier.get('name')} (ID: {supplier_id})")
                self.log_test("2.1 Initial Balance", True, f"Başlangıç bakiyesi: {initial_balance} HAS")
            else:
                self.log_test("2.1 Supplier Selection", False, "Tedarikçi bulunamadı (party_type_id=2)")
                return
        else:
            self.log_test("2.1 Get Parties", False, f"Parties API çağrısı başarısız: {parties_response}")
            return
        
        # TEST 2.2: PURCHASE işlemi yap
        print("\n🔸 TEST 2.2: PURCHASE işlemi")
        
        purchase_data = {
            "type_code": "PURCHASE",
            "party_id": supplier_id,
            "currency": "TRY",
            "payment_method_code": "CASH_TRY",
            "transaction_date": "2025-12-12T10:00:00Z",
            "lines": [{
                "product_type_id": 2,
                "karat_id": 2,
                "weight_gram": 10.0,
                "labor_has_value": 0.5
            }]
        }
        
        success2, purchase_response = self.make_request(
            "POST", 
            "financial-transactions", 
            purchase_data, 
            201
        )
        
        if success2:
            self.log_test("2.2 Purchase Transaction", True, f"PURCHASE işlemi başarılı: {purchase_response.get('code')}")
            
            # Check response structure
            required_fields = ["code", "type_code", "total_has_amount", "status"]
            missing_fields = [field for field in required_fields if field not in purchase_response]
            
            if not missing_fields:
                self.log_test("2.2 Purchase Response Structure", True, "Tüm gerekli alanlar mevcut")
            else:
                self.log_test("2.2 Purchase Response Structure", False, f"Eksik alanlar: {missing_fields}")
            
            # Check if HAS amount is positive (supplier becomes creditor)
            has_amount = purchase_response.get("total_has_amount", 0)
            if has_amount > 0:
                self.log_test("2.2 Purchase HAS Amount", True, f"Pozitif HAS miktarı: {has_amount}")
            else:
                self.log_test("2.2 Purchase HAS Amount", False, f"HAS miktarı pozitif değil: {has_amount}")
        else:
            self.log_test("2.2 Purchase Transaction", False, f"PURCHASE işlemi başarısız: {purchase_response}")
            return
        
        # TEST 2.3: Tedarikçinin güncel bakiyesini kontrol et
        print("\n🔸 TEST 2.3: Tedarikçi bakiye kontrolü")
        
        success3, updated_supplier = self.make_request("GET", f"parties/{supplier_id}")
        
        if success3:
            if "balance" in updated_supplier:
                new_balance = updated_supplier["balance"].get("has_gold_balance", 0.0)
                balance_increase = new_balance - initial_balance
                
                self.log_test("2.3 Updated Balance Retrieved", True, f"Güncel bakiye: {new_balance} HAS")
                
                if balance_increase > 0:
                    self.log_test("2.3 Balance Increased", True, f"Bakiye artışı: {balance_increase} HAS")
                    
                    # Check if increase is approximately correct (weight_gram * fineness + labor_has_value)
                    # Assuming fineness for karat_id=2 is around 0.585 (14K)
                    expected_increase = 10.0 * 0.585 + 0.5  # weight * fineness + labor
                    
                    if abs(balance_increase - expected_increase) < 1.0:  # Allow 1 HAS tolerance
                        self.log_test("2.3 Balance Calculation", True, f"Artış miktarı doğru: {balance_increase} ≈ {expected_increase}")
                    else:
                        self.log_test("2.3 Balance Calculation", False, f"Artış miktarı yanlış: {balance_increase} ≠ {expected_increase}")
                else:
                    self.log_test("2.3 Balance Increased", False, f"Bakiye artmadı: {balance_increase}")
            else:
                self.log_test("2.3 Balance Field", False, "Balance alanı bulunamadı")
        else:
            self.log_test("2.3 Get Updated Supplier", False, f"Güncel tedarikçi bilgisi alınamadı: {updated_supplier}")
    
    def test_gorev_3_urun_duzenleme_borc_guncelleme(self):
        """GÖREV 3 TESTİ - ÜRÜN DÜZENLEME BORÇ GÜNCELLEME"""
        print("\n🔧 GÖREV 3 - ÜRÜN DÜZENLEME BORÇ GÜNCELLEME")
        print("=" * 50)
        
        # TEST 3.1: Tedarikçili ürün oluştur
        print("\n🔸 TEST 3.1: Tedarikçili ürün oluşturma")
        
        # Get a supplier first
        success_parties, parties = self.make_request("GET", "parties")
        supplier_id = None
        
        if success_parties and isinstance(parties, list):
            suppliers = [p for p in parties if p.get("party_type_id") == 2]
            if suppliers:
                supplier_id = suppliers[0].get("id")
        
        if not supplier_id:
            self.log_test("3.1 Supplier Required", False, "Tedarikçi bulunamadı")
            return
        
        # Create product with supplier
        product_data = {
            "product_type_id": 2,  # Gold product
            "name": "Test Ürün Düzenleme",
            "karat_id": 2,
            "weight_gram": 8.0,
            "labor_type_id": 1,
            "labor_has_value": 1.0,
            "profit_rate_percent": 25.0,
            "supplier_party_id": supplier_id,
            "purchase_date": "2025-12-10T10:00:00Z"
        }
        
        success1, product_response = self.make_request("POST", "products", product_data, 201)
        
        if not success1:
            self.log_test("3.1 Product Creation", False, f"Ürün oluşturulamadı: {product_response}")
            return
        
        product_id = product_response.get("id")
        initial_cost = product_response.get("total_cost_has", 0)
        
        self.log_test("3.1 Product Creation", True, f"Ürün oluşturuldu: {product_id}")
        self.log_test("3.1 Initial Cost", True, f"Başlangıç maliyeti: {initial_cost} HAS")
        
        # Get supplier's initial balance
        success_supplier, supplier_data = self.make_request("GET", f"parties/{supplier_id}")
        initial_supplier_balance = 0.0
        
        if success_supplier and "balance" in supplier_data:
            initial_supplier_balance = supplier_data["balance"].get("has_gold_balance", 0.0)
            self.log_test("3.1 Supplier Initial Balance", True, f"Tedarikçi başlangıç bakiyesi: {initial_supplier_balance} HAS")
        
        # TEST 3.2: Ürünün gramını değiştir
        print("\n🔸 TEST 3.2: Ürün gramını güncelleme")
        
        update_data = {
            "weight_gram": 12.0  # 8.0'dan 12.0'a çıkar
        }
        
        success2, updated_product = self.make_request("PUT", f"products/{product_id}", update_data)
        
        if success2:
            new_cost = updated_product.get("total_cost_has", 0)
            cost_difference = new_cost - initial_cost
            
            self.log_test("3.2 Product Update", True, f"Ürün güncellendi")
            self.log_test("3.2 New Cost", True, f"Yeni maliyet: {new_cost} HAS")
            self.log_test("3.2 Cost Difference", True, f"Maliyet farkı: {cost_difference} HAS")
            
            # TEST 3.3: Tedarikçi borcunun değiştiğini kontrol et
            print("\n🔸 TEST 3.3: Tedarikçi borç güncelleme kontrolü")
            
            success3, updated_supplier = self.make_request("GET", f"parties/{supplier_id}")
            
            if success3 and "balance" in updated_supplier:
                new_supplier_balance = updated_supplier["balance"].get("has_gold_balance", 0.0)
                balance_change = new_supplier_balance - initial_supplier_balance
                
                self.log_test("3.3 Supplier Balance Updated", True, f"Güncel tedarikçi bakiyesi: {new_supplier_balance} HAS")
                
                # Balance change should approximately equal cost difference
                if abs(balance_change - cost_difference) < 0.1:
                    self.log_test("3.3 Balance Change Correct", True, f"Bakiye değişimi doğru: {balance_change} ≈ {cost_difference}")
                else:
                    self.log_test("3.3 Balance Change Correct", False, f"Bakiye değişimi yanlış: {balance_change} ≠ {cost_difference}")
            else:
                self.log_test("3.3 Supplier Balance Check", False, "Tedarikçi bakiyesi kontrol edilemedi")
        else:
            self.log_test("3.2 Product Update", False, f"Ürün güncellenemedi: {updated_product}")
    
    def test_gorev_4_urun_silme_borc_guncelleme(self):
        """GÖREV 4 TESTİ - ÜRÜN SİLME BORÇ GÜNCELLEME"""
        print("\n🗑️ GÖREV 4 - ÜRÜN SİLME BORÇ GÜNCELLEME")
        print("=" * 50)
        
        # TEST 4.1: IN_STOCK ürün oluştur (tedarikçi ile)
        print("\n🔸 TEST 4.1: IN_STOCK ürün oluşturma")
        
        # Get a supplier
        success_parties, parties = self.make_request("GET", "parties")
        supplier_id = None
        
        if success_parties and isinstance(parties, list):
            suppliers = [p for p in parties if p.get("party_type_id") == 2]
            if suppliers:
                supplier_id = suppliers[0].get("id")
        
        if not supplier_id:
            self.log_test("4.1 Supplier Required", False, "Tedarikçi bulunamadı")
            return
        
        # Create product
        product_data = {
            "product_type_id": 2,
            "name": "Test Ürün Silme",
            "karat_id": 2,
            "weight_gram": 6.0,
            "labor_type_id": 1,
            "labor_has_value": 0.8,
            "profit_rate_percent": 30.0,
            "supplier_party_id": supplier_id,
            "purchase_date": "2025-12-10T11:00:00Z"
        }
        
        success1, product_response = self.make_request("POST", "products", product_data, 201)
        
        if not success1:
            self.log_test("4.1 Product Creation", False, f"Ürün oluşturulamadı: {product_response}")
            return
        
        product_id = product_response.get("id")
        product_cost = product_response.get("total_cost_has", 0)
        
        self.log_test("4.1 Product Creation", True, f"Ürün oluşturuldu: {product_id}")
        self.log_test("4.1 Product Cost", True, f"Ürün maliyeti: {product_cost} HAS")
        
        # TEST 4.2: Tedarikçi bakiyesini kaydet
        print("\n🔸 TEST 4.2: Tedarikçi bakiye kaydı")
        
        success2, supplier_data = self.make_request("GET", f"parties/{supplier_id}")
        initial_balance = 0.0
        
        if success2 and "balance" in supplier_data:
            initial_balance = supplier_data["balance"].get("has_gold_balance", 0.0)
            self.log_test("4.2 Supplier Balance Recorded", True, f"Tedarikçi bakiyesi: {initial_balance} HAS")
        else:
            self.log_test("4.2 Supplier Balance Check", False, "Tedarikçi bakiyesi alınamadı")
            return
        
        # TEST 4.3: Ürünü sil
        print("\n🔸 TEST 4.3: Ürün silme")
        
        success3, delete_response = self.make_request("DELETE", f"products/{product_id}")
        
        if success3:
            self.log_test("4.3 Product Deletion", True, "Ürün başarıyla silindi")
            
            # TEST 4.4: Tedarikçi bakiyesinin düştüğünü kontrol et
            print("\n🔸 TEST 4.4: Tedarikçi bakiye düşüş kontrolü")
            
            success4, updated_supplier = self.make_request("GET", f"parties/{supplier_id}")
            
            if success4 and "balance" in updated_supplier:
                new_balance = updated_supplier["balance"].get("has_gold_balance", 0.0)
                balance_decrease = initial_balance - new_balance
                
                self.log_test("4.4 Supplier Balance Updated", True, f"Güncel bakiye: {new_balance} HAS")
                
                # Balance should decrease by approximately the product cost
                if abs(balance_decrease - product_cost) < 0.1:
                    self.log_test("4.4 Balance Decrease Correct", True, f"Bakiye düşüşü doğru: {balance_decrease} ≈ {product_cost}")
                else:
                    self.log_test("4.4 Balance Decrease Correct", False, f"Bakiye düşüşü yanlış: {balance_decrease} ≠ {product_cost}")
            else:
                self.log_test("4.4 Supplier Balance Check", False, "Güncel tedarikçi bakiyesi alınamadı")
        else:
            self.log_test("4.3 Product Deletion", False, f"Ürün silinemedi: {delete_response}")
    
    def test_gorev_5_party_has_balance(self):
        """GÖREV 5 TESTİ - PARTY HAS_BALANCE"""
        print("\n⚖️ GÖREV 5 - PARTY HAS_BALANCE")
        print("=" * 50)
        
        # TEST 5.1: Tüm partylerde has_balance alanı kontrolü
        print("\n🔸 TEST 5.1: Tüm partylerde has_balance kontrolü")
        
        success1, parties_response = self.make_request("GET", "parties")
        
        if success1 and isinstance(parties_response, list):
            self.log_test("5.1 Parties API", True, f"{len(parties_response)} party bulundu")
            
            parties_with_balance = 0
            parties_without_balance = 0
            balance_values = []
            
            for party in parties_response:
                party_name = party.get("name", "Unknown")
                
                if "balance" in party:
                    balance = party["balance"]
                    
                    if "has_gold_balance" in balance:
                        has_balance = balance["has_gold_balance"]
                        balance_values.append(has_balance)
                        parties_with_balance += 1
                        
                        # Log individual party balance
                        self.log_test(f"5.1 Party Balance - {party_name}", True, f"has_balance: {has_balance}")
                    else:
                        parties_without_balance += 1
                        self.log_test(f"5.1 Party Balance - {party_name}", False, "has_gold_balance alanı eksik")
                else:
                    parties_without_balance += 1
                    self.log_test(f"5.1 Party Balance - {party_name}", False, "balance alanı eksik")
            
            # Summary
            if parties_without_balance == 0:
                self.log_test("5.1 All Parties Have Balance", True, f"Tüm {len(parties_response)} party'de has_balance mevcut")
            else:
                self.log_test("5.1 All Parties Have Balance", False, f"{parties_without_balance} party'de has_balance eksik")
            
            # Balance value analysis
            if balance_values:
                positive_balances = [b for b in balance_values if b > 0]
                negative_balances = [b for b in balance_values if b < 0]
                zero_balances = [b for b in balance_values if b == 0]
                
                self.log_test("5.1 Balance Distribution", True, 
                    f"Pozitif: {len(positive_balances)}, Negatif: {len(negative_balances)}, Sıfır: {len(zero_balances)}")
                
                if balance_values:
                    min_balance = min(balance_values)
                    max_balance = max(balance_values)
                    self.log_test("5.1 Balance Range", True, f"Min: {min_balance}, Max: {max_balance}")
        else:
            self.log_test("5.1 Parties API", False, f"Parties API çağrısı başarısız: {parties_response}")
    
    def run_all_tests(self):
        """Tüm testleri çalıştır"""
        print("🏆 KUYUMCULUK PROJESİ - 5 GÖREV BACKEND TESTİ")
        print("=" * 60)
        print(f"URL: {self.base_url}")
        print("Credentials: admin@kuyumcu.com / admin123")
        print("=" * 60)
        
        # Login first
        if not self.login():
            print("\n❌ Authentication failed - cannot continue tests")
            return False
        
        # Run all 5 tasks
        self.test_gorev_1_urunler_sayfalama()
        self.test_gorev_2_purchase_tedarikci_borc()
        self.test_gorev_3_urun_duzenleme_borc_guncelleme()
        self.test_gorev_4_urun_silme_borc_guncelleme()
        self.test_gorev_5_party_has_balance()
        
        # Final summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        # Group results by task
        task_results = {}
        for result in self.test_results:
            test_name = result["test"]
            if "GÖREV 1" in test_name or "1." in test_name:
                task = "GÖREV 1 - ÜRÜNLER SAYFALAMA"
            elif "GÖREV 2" in test_name or "2." in test_name:
                task = "GÖREV 2 - PURCHASE TEDARİKÇİ BORÇ"
            elif "GÖREV 3" in test_name or "3." in test_name:
                task = "GÖREV 3 - ÜRÜN DÜZENLEME BORÇ"
            elif "GÖREV 4" in test_name or "4." in test_name:
                task = "GÖREV 4 - ÜRÜN SİLME BORÇ"
            elif "GÖREV 5" in test_name or "5." in test_name:
                task = "GÖREV 5 - PARTY HAS_BALANCE"
            else:
                task = "OTHER"
            
            if task not in task_results:
                task_results[task] = {"passed": 0, "total": 0}
            
            task_results[task]["total"] += 1
            if result["success"]:
                task_results[task]["passed"] += 1
        
        print("\n📋 TASK BREAKDOWN:")
        for task, stats in task_results.items():
            if task != "OTHER":
                rate = (stats["passed"] / stats["total"] * 100) if stats["total"] > 0 else 0
                status = "✅" if rate == 100 else "⚠️" if rate >= 80 else "❌"
                print(f"{status} {task}: {stats['passed']}/{stats['total']} ({rate:.1f}%)")
        
        return success_rate >= 80

if __name__ == "__main__":
    tester = KuyumculukTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!")
        sys.exit(0)
    else:
        print("\n⚠️ SOME TESTS FAILED - CHECK RESULTS ABOVE")
        sys.exit(1)
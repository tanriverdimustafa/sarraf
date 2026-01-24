import requests
import sys
import json
from datetime import datetime

class UnifiedLedgerTester:
    def __init__(self, base_url="http://localhost:8001"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
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

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        
        # Default headers
        default_headers = {'Content-Type': 'application/json'}
        if self.token:
            default_headers['Authorization'] = f'Bearer {self.token}'
        
        # Merge with provided headers
        if headers:
            default_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=default_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=default_headers, timeout=10)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                details += f" (Expected: {expected_status})"
                try:
                    error_data = response.json()
                    details += f", Response: {error_data}"
                except:
                    details += f", Response: {response.text[:200]}"
            
            self.log_test(name, success, details)
            
            return success, response.json() if success and response.content else {}

        except Exception as e:
            self.log_test(name, False, f"Error: {str(e)}")
            return False, {}

    def test_user_login(self, email="admin@kuyumcu.com", password="admin123"):
        """Test user login with provided credentials"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        
        if success and 'token' in response:
            self.token = response['token']
            return True
        return False

    def test_unified_ledger_new_features(self):
        """Test new unified ledger features as requested in Turkish review"""
        print("\n🏆 UNIFIED LEDGER EKSİKLERİN TAMAMLANMASI - Backend Test")
        print("=" * 60)
        
        # Login with admin credentials as specified
        login_success = self.test_user_login("admin@kuyumcu.com", "admin123")
        
        if not login_success:
            self.log_test("Unified Ledger Test", False, "Authentication failed - cannot continue")
            return False
        
        # Initialize test results table
        test_results = {}
        
        # BÖLÜM 1: CREATE KAYITLARI
        print("\n🔸 BÖLÜM 1: CREATE KAYITLARI")
        print("-" * 40)
        
        # 1.1 Kasa transferi
        test_results["1.1"] = self.test_cash_transfer()
        
        # 1.2 Manuel kasa hareketi
        test_results["1.2"] = self.test_manual_cash_movement()
        
        # 1.3 Açılış bakiyesi
        test_results["1.3"] = self.test_opening_balance()
        
        # 1.4 Döviz değişim
        test_results["1.4"] = self.test_exchange_transaction_unified()
        
        # BÖLÜM 2: SİLME + VOID KAYITLARI
        print("\n🔸 BÖLÜM 2: SİLME + VOID KAYITLARI")
        print("-" * 40)
        
        # 2.1 Maaş hareketi sil
        test_results["2.1"] = self.test_salary_movement_delete()
        
        # 2.2 Personel borç sil
        test_results["2.2"] = self.test_employee_debt_delete()
        
        # 2.3 Sermaye hareketi sil
        test_results["2.3"] = self.test_capital_movement_delete()
        
        # 2.4 Kasa hareketi sil
        test_results["2.4"] = self.test_cash_movement_delete()
        
        # BÖLÜM 3: ADJUSTMENT KAYITLARI
        print("\n🔸 BÖLÜM 3: ADJUSTMENT KAYITLARI")
        print("-" * 40)
        
        # 3.1 Gider düzenle
        test_results["3.1"] = self.test_expense_adjustment()
        
        # REGRESYON TESTLERİ
        print("\n🔸 REGRESYON TESTLERİ (14 TEST)")
        print("-" * 40)
        
        regression_results = self.run_regression_tests()
        test_results["REG"] = regression_results
        
        # Print test results table
        print("\n" + "=" * 60)
        print("TEST SONUÇ TABLOSU")
        print("=" * 60)
        print("| # | Test | Sonuç | Notlar |")
        print("|---|------|-------|--------|")
        
        test_descriptions = {
            "1.1": "Kasa Transferi CREATE",
            "1.2": "Manuel Kasa CREATE", 
            "1.3": "Açılış Bakiyesi CREATE",
            "1.4": "Döviz Değişim CREATE",
            "2.1": "Maaş Silme VOID",
            "2.2": "Personel Borç Silme VOID",
            "2.3": "Sermaye Silme VOID", 
            "2.4": "Kasa Hareketi Silme VOID",
            "3.1": "Gider Düzenleme ADJUSTMENT",
            "REG": "Regresyon (14 test)"
        }
        
        passed_count = 0
        total_count = len(test_results)
        
        for test_id, success in test_results.items():
            status = "✅" if success else "❌"
            description = test_descriptions.get(test_id, test_id)
            print(f"| {test_id} | {description} | {status} | |")
            if success:
                passed_count += 1
        
        print("=" * 60)
        success_rate = (passed_count / total_count) * 100 if total_count > 0 else 0
        print(f"TOPLAM: {passed_count}/{total_count} = %{success_rate:.1f}")
        
        return success_rate >= 90  # 90% success rate required
    
    def test_cash_transfer(self):
        """1.1 Kasa transferi - POST /api/cash-movements/transfer"""
        try:
            # Get available cash registers first
            success_get, cash_registers = self.run_test(
                "Get Cash Registers",
                "GET", 
                "cash-registers",
                200
            )
            
            if not success_get or not cash_registers or len(cash_registers) < 2:
                self.log_test("1.1 Kasa Transferi", False, "Need at least 2 cash registers")
                return False
            
            transfer_data = {
                "from_cash_register_id": cash_registers[0]["id"],
                "to_cash_register_id": cash_registers[1]["id"],
                "amount": 1000.0,
                "description": "Test kasa transferi",
                "transaction_date": datetime.now().isoformat()
            }
            
            success, response = self.run_test(
                "1.1 Kasa Transferi",
                "POST",
                "cash-movements/transfer", 
                201,
                data=transfer_data
            )
            
            if success:
                # Check unified ledger for CASH_TRANSFER record
                return self.check_unified_ledger_entry("CASH_TRANSFER", "Kasa transferi")
            
            return False
            
        except Exception as e:
            self.log_test("1.1 Kasa Transferi", False, f"Error: {str(e)}")
            return False
    
    def test_manual_cash_movement(self):
        """1.2 Manuel kasa hareketi - POST /api/cash-movements (reference_type: MANUAL)"""
        try:
            # Get first cash register
            success_get, cash_registers = self.run_test(
                "Get Cash Registers for Manual Movement",
                "GET",
                "cash-registers", 
                200
            )
            
            if not success_get or not cash_registers:
                self.log_test("1.2 Manuel Kasa Hareketi", False, "No cash registers available")
                return False
            
            manual_data = {
                "cash_register_id": cash_registers[0]["id"],
                "amount": 500.0,
                "movement_type": "IN",
                "reference_type": "MANUAL",
                "description": "Test manuel kasa hareketi",
                "transaction_date": datetime.now().isoformat()
            }
            
            success, response = self.run_test(
                "1.2 Manuel Kasa Hareketi",
                "POST",
                "cash-movements",
                201,
                data=manual_data
            )
            
            if success:
                # Check unified ledger for MANUAL_CASH record
                return self.check_unified_ledger_entry("MANUAL_CASH", "Manuel kasa")
            
            return False
            
        except Exception as e:
            self.log_test("1.2 Manuel Kasa Hareketi", False, f"Error: {str(e)}")
            return False
    
    def test_opening_balance(self):
        """1.3 Açılış bakiyesi - POST /api/cash-movements/opening"""
        try:
            # Get first cash register
            success_get, cash_registers = self.run_test(
                "Get Cash Registers for Opening Balance",
                "GET",
                "cash-registers",
                200
            )
            
            if not success_get or not cash_registers:
                self.log_test("1.3 Açılış Bakiyesi", False, "No cash registers available")
                return False
            
            opening_data = {
                "cash_register_id": cash_registers[0]["id"],
                "opening_balance": 10000.0,
                "opening_date": datetime.now().isoformat(),
                "notes": "Test açılış bakiyesi"
            }
            
            success, response = self.run_test(
                "1.3 Açılış Bakiyesi",
                "POST",
                "cash-movements/opening",
                201,
                data=opening_data
            )
            
            if success:
                # Check unified ledger for OPENING_BALANCE record
                return self.check_unified_ledger_entry("OPENING_BALANCE", "Açılış bakiyesi")
            
            return False
            
        except Exception as e:
            self.log_test("1.3 Açılış Bakiyesi", False, f"Error: {str(e)}")
            return False
    
    def test_exchange_transaction_unified(self):
        """1.4 Döviz değişim - POST /api/financial-transactions (type_code: EXCHANGE)"""
        try:
            exchange_data = {
                "type_code": "EXCHANGE",
                "transaction_date": datetime.now().isoformat(),
                "from_currency": "TRY",
                "to_currency": "USD", 
                "from_amount": 35000.0,
                "to_amount": 1000.0,
                "fx_rate": 35.0,
                "notes": "Test döviz değişimi"
            }
            
            success, response = self.run_test(
                "1.4 Döviz Değişim",
                "POST",
                "financial-transactions",
                201,
                data=exchange_data
            )
            
            if success:
                # Check unified ledger for EXCHANGE record
                return self.check_unified_ledger_entry("EXCHANGE", "Döviz değişimi")
            
            return False
            
        except Exception as e:
            self.log_test("1.4 Döviz Değişim", False, f"Error: {str(e)}")
            return False
    
    def test_salary_movement_delete(self):
        """2.1 Maaş hareketi sil - DELETE /api/salary-movements/{id}"""
        try:
            # First create a salary movement
            salary_data = {
                "employee_id": "test-employee-id",
                "amount": 15000.0,
                "salary_date": datetime.now().isoformat(),
                "description": "Test maaş hareketi"
            }
            
            success_create, create_response = self.run_test(
                "Create Salary Movement for Delete Test",
                "POST",
                "salary-movements",
                201,
                data=salary_data
            )
            
            if not success_create:
                self.log_test("2.1 Maaş Silme VOID", False, "Could not create salary movement")
                return False
            
            salary_id = create_response.get("id")
            
            # Now delete it
            success_delete, delete_response = self.run_test(
                "2.1 Maaş Silme",
                "DELETE",
                f"salary-movements/{salary_id}",
                200
            )
            
            if success_delete:
                # Check unified ledger for VOID record with reference_type: salary_movements
                return self.check_unified_ledger_void_entry("salary_movements", salary_id)
            
            return False
            
        except Exception as e:
            self.log_test("2.1 Maaş Silme VOID", False, f"Error: {str(e)}")
            return False
    
    def test_employee_debt_delete(self):
        """2.2 Personel borç sil - DELETE /api/employee-debts/{id}"""
        try:
            # First create an employee debt
            debt_data = {
                "employee_id": "test-employee-id",
                "amount": 5000.0,
                "debt_date": datetime.now().isoformat(),
                "description": "Test personel borcu"
            }
            
            success_create, create_response = self.run_test(
                "Create Employee Debt for Delete Test",
                "POST",
                "employee-debts",
                201,
                data=debt_data
            )
            
            if not success_create:
                self.log_test("2.2 Personel Borç Silme VOID", False, "Could not create employee debt")
                return False
            
            debt_id = create_response.get("id")
            
            # Now delete it
            success_delete, delete_response = self.run_test(
                "2.2 Personel Borç Silme",
                "DELETE",
                f"employee-debts/{debt_id}",
                200
            )
            
            if success_delete:
                # Check unified ledger for VOID record with reference_type: employee_debts
                return self.check_unified_ledger_void_entry("employee_debts", debt_id)
            
            return False
            
        except Exception as e:
            self.log_test("2.2 Personel Borç Silme VOID", False, f"Error: {str(e)}")
            return False
    
    def test_capital_movement_delete(self):
        """2.3 Sermaye hareketi sil - DELETE /api/capital-movements/{id}"""
        try:
            # First create a capital movement
            capital_data = {
                "partner_id": "test-partner-id",
                "amount": 25000.0,
                "movement_type": "IN",
                "movement_date": datetime.now().isoformat(),
                "description": "Test sermaye hareketi"
            }
            
            success_create, create_response = self.run_test(
                "Create Capital Movement for Delete Test",
                "POST",
                "capital-movements",
                201,
                data=capital_data
            )
            
            if not success_create:
                self.log_test("2.3 Sermaye Silme VOID", False, "Could not create capital movement")
                return False
            
            capital_id = create_response.get("id")
            
            # Now delete it
            success_delete, delete_response = self.run_test(
                "2.3 Sermaye Silme",
                "DELETE",
                f"capital-movements/{capital_id}",
                200
            )
            
            if success_delete:
                # Check unified ledger for VOID record with reference_type: capital_movements
                return self.check_unified_ledger_void_entry("capital_movements", capital_id)
            
            return False
            
        except Exception as e:
            self.log_test("2.3 Sermaye Silme VOID", False, f"Error: {str(e)}")
            return False
    
    def test_cash_movement_delete(self):
        """2.4 Kasa hareketi sil - DELETE /api/cash-movements/{id}"""
        try:
            # First get cash registers
            success_get, cash_registers = self.run_test(
                "Get Cash Registers for Movement Delete Test",
                "GET",
                "cash-registers",
                200
            )
            
            if not success_get or not cash_registers:
                self.log_test("2.4 Kasa Hareketi Silme VOID", False, "No cash registers available")
                return False
            
            # Create a cash movement
            movement_data = {
                "cash_register_id": cash_registers[0]["id"],
                "amount": 1500.0,
                "movement_type": "IN",
                "reference_type": "MANUAL",
                "description": "Test kasa hareketi for delete",
                "transaction_date": datetime.now().isoformat()
            }
            
            success_create, create_response = self.run_test(
                "Create Cash Movement for Delete Test",
                "POST",
                "cash-movements",
                201,
                data=movement_data
            )
            
            if not success_create:
                self.log_test("2.4 Kasa Hareketi Silme VOID", False, "Could not create cash movement")
                return False
            
            movement_id = create_response.get("id")
            
            # Now delete it
            success_delete, delete_response = self.run_test(
                "2.4 Kasa Hareketi Silme",
                "DELETE",
                f"cash-movements/{movement_id}",
                200
            )
            
            if success_delete:
                # Check unified ledger for VOID record with reference_type: cash_movements
                return self.check_unified_ledger_void_entry("cash_movements", movement_id)
            
            return False
            
        except Exception as e:
            self.log_test("2.4 Kasa Hareketi Silme VOID", False, f"Error: {str(e)}")
            return False
    
    def test_expense_adjustment(self):
        """3.1 Gider düzenle - PUT /api/expenses/{id} (amount değiştir)"""
        try:
            # First create an expense
            expense_data = {
                "category_id": "1",  # Assuming category exists
                "amount": 2000.0,
                "expense_date": datetime.now().isoformat(),
                "description": "Test gider for adjustment"
            }
            
            success_create, create_response = self.run_test(
                "Create Expense for Adjustment Test",
                "POST",
                "expenses",
                201,
                data=expense_data
            )
            
            if not success_create:
                self.log_test("3.1 Gider Düzenleme ADJUSTMENT", False, "Could not create expense")
                return False
            
            expense_id = create_response.get("id")
            
            # Now update the amount
            update_data = {
                "amount": 2500.0,  # Changed from 2000 to 2500
                "description": "Test gider updated for adjustment"
            }
            
            success_update, update_response = self.run_test(
                "3.1 Gider Düzenleme",
                "PUT",
                f"expenses/{expense_id}",
                200,
                data=update_data
            )
            
            if success_update:
                # Check unified ledger for ADJUSTMENT record with reference_type: expenses
                return self.check_unified_ledger_adjustment_entry("expenses", expense_id)
            
            return False
            
        except Exception as e:
            self.log_test("3.1 Gider Düzenleme ADJUSTMENT", False, f"Error: {str(e)}")
            return False
    
    def check_unified_ledger_entry(self, entry_type, description_contains):
        """Check if unified ledger contains entry of specific type"""
        try:
            success, response = self.run_test(
                f"Check Unified Ledger for {entry_type}",
                "GET",
                f"unified-ledger?entry_type={entry_type}",
                200
            )
            
            if success and isinstance(response, dict):
                entries = response.get('entries', [])
                for entry in entries:
                    if entry.get('entry_type') == entry_type:
                        self.log_test(f"Unified Ledger {entry_type} Entry", True, f"Found {entry_type} entry")
                        return True
                
                self.log_test(f"Unified Ledger {entry_type} Entry", False, f"No {entry_type} entry found")
                return False
            
            return False
            
        except Exception as e:
            self.log_test(f"Unified Ledger {entry_type} Check", False, f"Error: {str(e)}")
            return False
    
    def check_unified_ledger_void_entry(self, reference_type, reference_id):
        """Check if unified ledger contains VOID entry for specific reference"""
        try:
            success, response = self.run_test(
                f"Check Unified Ledger for VOID {reference_type}",
                "GET",
                "unified-ledger?entry_type=VOID",
                200
            )
            
            if success and isinstance(response, dict):
                entries = response.get('entries', [])
                for entry in entries:
                    if (entry.get('entry_type') == 'VOID' and 
                        entry.get('reference_type') == reference_type and
                        entry.get('reference_id') == reference_id):
                        self.log_test(f"Unified Ledger VOID Entry ({reference_type})", True, f"Found VOID entry for {reference_type}")
                        return True
                
                self.log_test(f"Unified Ledger VOID Entry ({reference_type})", False, f"No VOID entry found for {reference_type}")
                return False
            
            return False
            
        except Exception as e:
            self.log_test(f"Unified Ledger VOID Check ({reference_type})", False, f"Error: {str(e)}")
            return False
    
    def check_unified_ledger_adjustment_entry(self, reference_type, reference_id):
        """Check if unified ledger contains ADJUSTMENT entry for specific reference"""
        try:
            success, response = self.run_test(
                f"Check Unified Ledger for ADJUSTMENT {reference_type}",
                "GET",
                "unified-ledger?entry_type=ADJUSTMENT",
                200
            )
            
            if success and isinstance(response, dict):
                entries = response.get('entries', [])
                for entry in entries:
                    if (entry.get('entry_type') == 'ADJUSTMENT' and 
                        entry.get('reference_type') == reference_type and
                        entry.get('reference_id') == reference_id):
                        self.log_test(f"Unified Ledger ADJUSTMENT Entry ({reference_type})", True, f"Found ADJUSTMENT entry for {reference_type}")
                        return True
                
                self.log_test(f"Unified Ledger ADJUSTMENT Entry ({reference_type})", False, f"No ADJUSTMENT entry found for {reference_type}")
                return False
            
            return False
            
        except Exception as e:
            self.log_test(f"Unified Ledger ADJUSTMENT Check ({reference_type})", False, f"Error: {str(e)}")
            return False
    
    def run_regression_tests(self):
        """Run 14 regression tests to ensure existing features work"""
        print("Running 14 regression tests...")
        
        regression_results = []
        
        # 1. Login
        result1 = self.test_user_login("admin@kuyumcu.com", "admin123")
        regression_results.append(("Login", result1))
        
        # 2. Dashboard/Market data
        result2, _ = self.run_test("Dashboard Market Data", "GET", "market-data/latest", 200)
        regression_results.append(("Dashboard/Market data", result2))
        
        # 3. Parties
        result3, _ = self.run_test("Parties", "GET", "parties", 200)
        regression_results.append(("Parties", result3))
        
        # 4-7. Financial Transactions
        result4 = self.test_purchase_transaction_regression()
        regression_results.append(("PURCHASE", result4))
        
        result5 = self.test_sale_transaction_regression()
        regression_results.append(("SALE", result5))
        
        result6 = self.test_payment_transaction_regression()
        regression_results.append(("PAYMENT", result6))
        
        result7 = self.test_receipt_transaction_regression()
        regression_results.append(("RECEIPT", result7))
        
        # 8. Transaction Cancel
        result8 = self.test_transaction_cancel_regression()
        regression_results.append(("Transaction Cancel", result8))
        
        # 9. Product Add
        result9 = self.test_product_add_regression()
        regression_results.append(("Product Add", result9))
        
        # 10. Product Delete
        result10 = self.test_product_delete_regression()
        regression_results.append(("Product Delete", result10))
        
        # 11. Cash Registers
        result11, _ = self.run_test("Cash Registers", "GET", "cash-registers", 200)
        regression_results.append(("Cash Registers", result11))
        
        # 12. Expense Create
        result12 = self.test_expense_create_regression()
        regression_results.append(("Expense Create", result12))
        
        # 13. Stock Report
        result13, _ = self.run_test("Stock Report", "GET", "stock/summary", 200)
        regression_results.append(("Stock Report", result13))
        
        # 14. Unified Ledger Summary
        result14, _ = self.run_test("Unified Ledger Summary", "GET", "unified-ledger/summary", 200)
        regression_results.append(("Unified Ledger Summary", result14))
        
        # Print regression results
        passed = sum(1 for _, success in regression_results if success)
        total = len(regression_results)
        
        print(f"\nRegression Test Results: {passed}/{total} passed")
        for name, success in regression_results:
            status = "✅" if success else "❌"
            print(f"  {status} {name}")
        
        return passed == total  # All must pass
    
    def test_purchase_transaction_regression(self):
        """Test PURCHASE transaction for regression"""
        try:
            # Get parties first
            success_parties, parties = self.run_test("Get Parties for PURCHASE", "GET", "parties", 200)
            if not success_parties or not parties:
                return False
            
            supplier_id = parties[0].get('id') if parties else None
            if not supplier_id:
                return False
            
            purchase_data = {
                "type_code": "PURCHASE",
                "party_id": supplier_id,
                "transaction_date": datetime.now().isoformat(),
                "currency": "TRY",
                "total_amount_currency": 10000,
                "payment_method_code": "CASH",
                "lines": [{
                    "product_type_code": "GOLD_RING",
                    "karat_id": 1,
                    "weight_gram": 5.0,
                    "material_has": 4.5,
                    "labor_has": 1.0,
                    "line_total_has": 5.5
                }]
            }
            
            success, _ = self.run_test("PURCHASE Regression", "POST", "financial-transactions", 201, data=purchase_data)
            return success
            
        except Exception:
            return False
    
    def test_sale_transaction_regression(self):
        """Test SALE transaction for regression"""
        try:
            # Get parties and products
            success_parties, parties = self.run_test("Get Parties for SALE", "GET", "parties", 200)
            success_products, products_response = self.run_test("Get Products for SALE", "GET", "products?stock_status_id=1", 200)
            
            if not success_parties or not parties or not success_products:
                return False
            
            customer_id = parties[0].get('id') if parties else None
            products = products_response.get('products', []) if isinstance(products_response, dict) else []
            product_id = products[0].get('id') if products else None
            
            if not customer_id or not product_id:
                return False
            
            sale_data = {
                "type_code": "SALE",
                "party_id": customer_id,
                "transaction_date": datetime.now().isoformat(),
                "lines": [{"product_id": product_id}],
                "payment_type": "CASH"
            }
            
            success, _ = self.run_test("SALE Regression", "POST", "financial-transactions", 201, data=sale_data)
            return success
            
        except Exception:
            return False
    
    def test_payment_transaction_regression(self):
        """Test PAYMENT transaction for regression"""
        try:
            # Get parties
            success_parties, parties = self.run_test("Get Parties for PAYMENT", "GET", "parties", 200)
            if not success_parties or not parties:
                return False
            
            party_id = parties[0].get('id') if parties else None
            if not party_id:
                return False
            
            payment_data = {
                "type_code": "PAYMENT",
                "party_id": party_id,
                "transaction_date": datetime.now().isoformat(),
                "currency": "TRY",
                "total_amount_currency": 5000,
                "payment_method_code": "CASH"
            }
            
            success, _ = self.run_test("PAYMENT Regression", "POST", "financial-transactions", 201, data=payment_data)
            return success
            
        except Exception:
            return False
    
    def test_receipt_transaction_regression(self):
        """Test RECEIPT transaction for regression"""
        try:
            # Get parties
            success_parties, parties = self.run_test("Get Parties for RECEIPT", "GET", "parties", 200)
            if not success_parties or not parties:
                return False
            
            party_id = parties[0].get('id') if parties else None
            if not party_id:
                return False
            
            receipt_data = {
                "type_code": "RECEIPT",
                "party_id": party_id,
                "transaction_date": datetime.now().isoformat(),
                "currency": "TRY",
                "total_amount_currency": 3000,
                "payment_method_code": "CASH"
            }
            
            success, _ = self.run_test("RECEIPT Regression", "POST", "financial-transactions", 201, data=receipt_data)
            return success
            
        except Exception:
            return False
    
    def test_transaction_cancel_regression(self):
        """Test transaction cancel for regression"""
        try:
            # First create a transaction to cancel
            success_parties, parties = self.run_test("Get Parties for Cancel Test", "GET", "parties", 200)
            if not success_parties or not parties:
                return False
            
            party_id = parties[0].get('id') if parties else None
            if not party_id:
                return False
            
            # Create a PAYMENT transaction
            payment_data = {
                "type_code": "PAYMENT",
                "party_id": party_id,
                "transaction_date": datetime.now().isoformat(),
                "currency": "TRY",
                "total_amount_currency": 1000,
                "payment_method_code": "CASH"
            }
            
            success_create, create_response = self.run_test("Create Transaction for Cancel", "POST", "financial-transactions", 201, data=payment_data)
            if not success_create:
                return False
            
            transaction_code = create_response.get('code')
            if not transaction_code:
                return False
            
            # Now cancel it
            cancel_data = {"reason": "Test cancel"}
            success_cancel, _ = self.run_test("Cancel Transaction Regression", "POST", f"financial-transactions/{transaction_code}/cancel", 200, data=cancel_data)
            return success_cancel
            
        except Exception:
            return False
    
    def test_product_add_regression(self):
        """Test product add for regression"""
        try:
            timestamp = datetime.now().strftime('%H%M%S')
            product_data = {
                "product_type_id": 1,
                "name": f"Test Regression Product {timestamp}",
                "karat_id": 1,
                "weight_gram": 3.0,
                "profit_rate_percent": 20.0
            }
            
            success, _ = self.run_test("Product Add Regression", "POST", "products", 201, data=product_data)
            return success
            
        except Exception:
            return False
    
    def test_product_delete_regression(self):
        """Test product delete for regression"""
        try:
            # First create a product to delete
            timestamp = datetime.now().strftime('%H%M%S')
            product_data = {
                "product_type_id": 1,
                "name": f"Test Delete Product {timestamp}",
                "karat_id": 1,
                "weight_gram": 2.0,
                "profit_rate_percent": 15.0
            }
            
            success_create, create_response = self.run_test("Create Product for Delete", "POST", "products", 201, data=product_data)
            if not success_create:
                return False
            
            product_id = create_response.get('id')
            if not product_id:
                return False
            
            # Now delete it
            success_delete, _ = self.run_test("Product Delete Regression", "DELETE", f"products/{product_id}", 200)
            return success_delete
            
        except Exception:
            return False
    
    def test_expense_create_regression(self):
        """Test expense create for regression"""
        try:
            expense_data = {
                "category_id": "1",
                "amount": 1000.0,
                "expense_date": datetime.now().isoformat(),
                "description": "Test regression expense"
            }
            
            success, _ = self.run_test("Expense Create Regression", "POST", "expenses", 201, data=expense_data)
            return success
            
        except Exception:
            return False

def main():
    """Main function to run unified ledger tests"""
    tester = UnifiedLedgerTester()
    
    # Run unified ledger tests
    success = tester.test_unified_ledger_new_features()
    
    # Print final summary
    print(f"\n📊 FINAL TEST SUMMARY")
    print("=" * 50)
    print(f"Total Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%" if tester.tests_run > 0 else "No tests run")
    
    # Show failed tests
    failed_tests = [test for test in tester.test_results if not test['success']]
    if failed_tests:
        print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
        for test in failed_tests:
            print(f"   - {test['test']}: {test['details']}")
    else:
        print("\n✅ ALL TESTS PASSED!")
    
    # Return success if all tests passed
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
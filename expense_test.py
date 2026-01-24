#!/usr/bin/env python3
"""
KUYUMCULUK PROJESİ - GİDER LİSTESİ SAYFALAMA VE SIRALAMA TESTİ
Expense Management Pagination and Sorting Tests
"""

import requests
import json
from datetime import datetime

class ExpenseAPITester:
    def __init__(self, base_url="https://task-viewer-4.preview.emergentagent.com"):
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

    def authenticate(self):
        """Register and authenticate a test user"""
        # Try to register a new user
        timestamp = datetime.now().strftime('%H%M%S')
        user_data = {
            "email": f"test_expense_{timestamp}@test.com",
            "password": "test123",
            "name": "Expense Test User",
            "role": "ADMIN"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=user_data
        )
        
        if success and 'token' in response:
            self.token = response['token']
            return True
        return False

    def test_expense_pagination_and_sorting(self):
        """KUYUMCULUK PROJESİ - GİDER LİSTESİ SAYFALAMA VE SIRALAMA TESTİ"""
        print("\n🏆 KUYUMCULUK PROJESİ - GİDER LİSTESİ SAYFALAMA VE SIRALAMA TESTİ")
        print("=" * 70)
        
        # Authenticate first
        if not self.authenticate():
            self.log_test("Expense Pagination Test", False, "Authentication failed - cannot continue")
            return False
        
        # TEST A - SAYFALAMA API TESTİ
        print("\n🔸 TEST A - SAYFALAMA API TESTİ")
        print("-" * 40)
        
        success_a1, response_a1 = self.run_test(
            "A.1 GET /api/expenses?page=1&per_page=10 - Başarılı yanıt",
            "GET",
            "expenses?page=1&per_page=10",
            200
        )
        
        if success_a1:
            # Check if response has expenses array
            if 'expenses' in response_a1 and isinstance(response_a1['expenses'], list):
                self.log_test("A.2 Expenses array kontrolü", True, f"Found expenses array with {len(response_a1['expenses'])} items")
            else:
                self.log_test("A.2 Expenses array kontrolü", False, "No expenses array in response")
            
            # Check pagination object
            if 'pagination' in response_a1:
                pagination = response_a1['pagination']
                required_fields = ['page', 'total_pages', 'total_records']
                missing_fields = [field for field in required_fields if field not in pagination]
                
                if not missing_fields:
                    self.log_test("A.3 Pagination objesi kontrolü", True, 
                                f"page: {pagination['page']}, total_pages: {pagination['total_pages']}, total_records: {pagination['total_records']}")
                    
                    # Verify page is 1
                    if pagination['page'] == 1:
                        self.log_test("A.4 Page değeri kontrolü", True, "page: 1")
                    else:
                        self.log_test("A.4 Page değeri kontrolü", False, f"Expected page: 1, got: {pagination['page']}")
                else:
                    self.log_test("A.3 Pagination objesi kontrolü", False, f"Missing fields: {missing_fields}")
            else:
                self.log_test("A.3 Pagination objesi kontrolü", False, "No pagination object in response")
        
        # TEST B - SAYFA DEĞİŞTİRME
        print("\n🔸 TEST B - SAYFA DEĞİŞTİRME")
        print("-" * 40)
        
        success_b1, response_b1 = self.run_test(
            "B.1 GET /api/expenses?page=2&per_page=10 - 2. sayfa",
            "GET",
            "expenses?page=2&per_page=10",
            200
        )
        
        if success_b1 and 'pagination' in response_b1:
            pagination = response_b1['pagination']
            if pagination.get('page') == 2:
                self.log_test("B.2 2. sayfa kontrolü", True, f"page: {pagination['page']}")
            else:
                self.log_test("B.2 2. sayfa kontrolü", False, f"Expected page: 2, got: {pagination.get('page')}")
        
        # TEST C - PER_PAGE DEĞİŞTİRME
        print("\n🔸 TEST C - PER_PAGE DEĞİŞTİRME")
        print("-" * 40)
        
        success_c1, response_c1 = self.run_test(
            "C.1 GET /api/expenses?page=1&per_page=20 - 20 kayıt",
            "GET",
            "expenses?page=1&per_page=20",
            200
        )
        
        if success_c1 and 'expenses' in response_c1:
            expense_count = len(response_c1['expenses'])
            if expense_count <= 20:
                self.log_test("C.2 Per_page=20 kontrolü", True, f"Returned {expense_count} records (≤20)")
            else:
                self.log_test("C.2 Per_page=20 kontrolü", False, f"Returned {expense_count} records (>20)")
        
        success_c3, response_c3 = self.run_test(
            "C.3 GET /api/expenses?page=1&per_page=50 - 50 kayıt",
            "GET",
            "expenses?page=1&per_page=50",
            200
        )
        
        if success_c3 and 'expenses' in response_c3:
            expense_count = len(response_c3['expenses'])
            if expense_count <= 50:
                self.log_test("C.4 Per_page=50 kontrolü", True, f"Returned {expense_count} records (≤50)")
            else:
                self.log_test("C.4 Per_page=50 kontrolü", False, f"Returned {expense_count} records (>50)")
        
        # TEST D - SIRALAMA KONTROLÜ
        print("\n🔸 TEST D - SIRALAMA KONTROLÜ")
        print("-" * 40)
        
        success_d1, response_d1 = self.run_test(
            "D.1 GET /api/expenses?page=1&per_page=10 - Sıralama kontrolü",
            "GET",
            "expenses?page=1&per_page=10",
            200
        )
        
        if success_d1 and 'expenses' in response_d1:
            expenses = response_d1['expenses']
            
            if len(expenses) > 0:
                # Check if first record has the most recent date
                first_expense = expenses[0]
                if 'expense_date' in first_expense:
                    self.log_test("D.2 İlk kayıt tarih kontrolü", True, f"First expense date: {first_expense['expense_date']}")
                else:
                    self.log_test("D.2 İlk kayıt tarih kontrolü", False, "No expense_date field in first record")
                
                # Check if dates are in descending order
                if len(expenses) >= 2:
                    dates_in_order = True
                    for i in range(len(expenses) - 1):
                        current_date = expenses[i].get('expense_date', '')
                        next_date = expenses[i + 1].get('expense_date', '')
                        
                        if current_date and next_date and current_date < next_date:
                            dates_in_order = False
                            break
                    
                    if dates_in_order:
                        self.log_test("D.3 Azalan sıralama kontrolü", True, "expense_date values in descending order")
                    else:
                        self.log_test("D.3 Azalan sıralama kontrolü", False, "expense_date values not in descending order")
                else:
                    self.log_test("D.3 Azalan sıralama kontrolü", True, "Not enough records to verify sorting (≤1 record)")
            else:
                self.log_test("D.2 İlk kayıt tarih kontrolü", True, "No expenses found - empty list is valid")
                self.log_test("D.3 Azalan sıralama kontrolü", True, "No expenses to sort - empty list is valid")
        
        # TEST E - FİLTRE İLE SAYFALAMA
        print("\n🔸 TEST E - FİLTRE İLE SAYFALAMA")
        print("-" * 40)
        
        # First get expense categories
        success_e1, categories = self.run_test(
            "E.1 GET /api/expense-categories - Kategori ID al",
            "GET",
            "expense-categories",
            200
        )
        
        category_id = None
        if success_e1 and isinstance(categories, list) and len(categories) > 0:
            category_id = categories[0].get('id')
            category_name = categories[0].get('name', 'Unknown')
            self.log_test("E.2 Kategori seçimi", True, f"Using category: {category_name} (ID: {category_id})")
        else:
            self.log_test("E.2 Kategori seçimi", False, "No categories found")
        
        if category_id:
            success_e3, response_e3 = self.run_test(
                f"E.3 GET /api/expenses?page=1&per_page=10&category_id={category_id} - Filtreli sayfalama",
                "GET",
                f"expenses?page=1&per_page=10&category_id={category_id}",
                200
            )
            
            if success_e3:
                if 'expenses' in response_e3:
                    filtered_expenses = response_e3['expenses']
                    
                    # Check if all expenses belong to the selected category (if any exist)
                    if len(filtered_expenses) > 0:
                        all_match_category = True
                        for expense in filtered_expenses:
                            if expense.get('category_id') != category_id:
                                all_match_category = False
                                break
                        
                        if all_match_category:
                            self.log_test("E.4 Kategori filtresi kontrolü", True, f"All {len(filtered_expenses)} expenses match category {category_id}")
                        else:
                            self.log_test("E.4 Kategori filtresi kontrolü", False, "Some expenses don't match the selected category")
                    else:
                        self.log_test("E.4 Kategori filtresi kontrolü", True, "No expenses found for this category - filter working correctly")
                
                # Check if pagination still works with filter
                if 'pagination' in response_e3:
                    pagination = response_e3['pagination']
                    if 'page' in pagination and 'total_pages' in pagination and 'total_records' in pagination:
                        self.log_test("E.5 Filtreli sayfalama kontrolü", True, 
                                    f"Pagination works with filter: page {pagination['page']}/{pagination['total_pages']}, {pagination['total_records']} records")
                    else:
                        self.log_test("E.5 Filtreli sayfalama kontrolü", False, "Pagination object incomplete with filter")
                else:
                    self.log_test("E.5 Filtreli sayfalama kontrolü", False, "No pagination object with filter")
        
        # SUMMARY
        print("\n🔸 TEST SUMMARY")
        print("-" * 40)
        
        all_tests = [success_a1, success_b1, success_c1, success_c3, success_d1, success_e1]
        if category_id:
            all_tests.append(success_e3)
        
        passed_tests = sum(1 for test in all_tests if test)
        total_tests = len(all_tests)
        
        self.log_test(
            "Gider Sayfalama ve Sıralama Testi",
            passed_tests == total_tests,
            f"Passed: {passed_tests}/{total_tests} tests ({(passed_tests/total_tests*100):.1f}% success rate)"
        )
        
        return passed_tests == total_tests

    def run_all_tests(self):
        """Run all expense tests"""
        print("🚀 STARTING EXPENSE MANAGEMENT TESTS")
        print("=" * 60)
        
        # Run the expense pagination and sorting tests
        self.test_expense_pagination_and_sorting()
        
        # Print final summary
        print("\n" + "=" * 60)
        print("🏁 TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        
        # Print failed tests
        failed_tests = [test for test in self.test_results if not test['success']]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = ExpenseAPITester()
    success = tester.run_all_tests()
    exit(0 if success else 1)
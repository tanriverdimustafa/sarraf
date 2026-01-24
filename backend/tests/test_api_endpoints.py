#!/usr/bin/env python3
"""
API Test Script for Kuyumcu Backend
Tests all critical endpoints before and after refactoring
"""
import requests
import json
import sys

BASE_URL = "http://localhost:8001/api"
TOKEN = None
RESULTS = []

def test_endpoint(name, method, url, expected_status, headers=None, json_data=None):
    """Test a single endpoint and record result"""
    global TOKEN
    
    try:
        if headers is None:
            headers = {}
        
        if TOKEN and "Authorization" not in headers:
            headers["Authorization"] = f"Bearer {TOKEN}"
        
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=10)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=json_data, timeout=10)
        elif method == "PUT":
            response = requests.put(url, headers=headers, json=json_data, timeout=10)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers, timeout=10)
        
        success = response.status_code == expected_status
        RESULTS.append({
            "name": name,
            "status": "✅ PASSED" if success else "❌ FAILED",
            "expected": expected_status,
            "actual": response.status_code,
            "url": url
        })
        
        if success:
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - Expected {expected_status}, got {response.status_code}")
            print(f"   Response: {response.text[:200]}")
        
        return response if success else None
        
    except Exception as e:
        RESULTS.append({
            "name": name,
            "status": "❌ ERROR",
            "error": str(e),
            "url": url
        })
        print(f"❌ {name} - Error: {e}")
        return None

def run_tests():
    global TOKEN
    
    print("\n" + "="*60)
    print("🧪 KUYUMCU BACKEND API TEST")
    print("="*60 + "\n")
    
    # 1. AUTH TESTS
    print("\n--- AUTH TESTS ---")
    
    # Login
    response = test_endpoint(
        "POST /api/auth/login",
        "POST",
        f"{BASE_URL}/auth/login",
        200,
        headers={"Content-Type": "application/json"},
        json_data={"email": "admin@kuyumcu.com", "password": "admin123"}
    )
    
    if response:
        data = response.json()
        TOKEN = data.get("token")
        print(f"   Token received: {TOKEN[:50]}...")
    
    # Get me
    test_endpoint("GET /api/auth/me", "GET", f"{BASE_URL}/auth/me", 200)
    
    # 2. PARTY TESTS
    print("\n--- PARTY TESTS ---")
    
    response = test_endpoint("GET /api/parties", "GET", f"{BASE_URL}/parties", 200)
    party_id = None
    if response:
        data = response.json()
        if data.get("data") and len(data["data"]) > 0:
            party_id = data["data"][0]["id"]
            print(f"   Found party: {party_id}")
    
    if party_id:
        test_endpoint(f"GET /api/parties/{party_id}", "GET", f"{BASE_URL}/parties/{party_id}", 200)
        test_endpoint(f"GET /api/parties/{party_id}/balance", "GET", f"{BASE_URL}/parties/{party_id}/balance", 200)
    
    # 3. PRODUCT TESTS
    print("\n--- PRODUCT TESTS ---")
    
    test_endpoint("GET /api/products", "GET", f"{BASE_URL}/products", 200)
    
    # 4. LOOKUP TESTS
    print("\n--- LOOKUP TESTS ---")
    
    lookups = ["karats", "currencies", "party-types", "payment-methods", "product-types", "labor-types", "stock-statuses"]
    for lookup in lookups:
        test_endpoint(f"GET /api/lookups/{lookup}", "GET", f"{BASE_URL}/lookups/{lookup}", 200)
    
    # Direct karats endpoint
    test_endpoint("GET /api/karats", "GET", f"{BASE_URL}/karats", 200)
    
    # Financial V2 lookups
    test_endpoint("GET /api/financial-v2/lookups/transaction-types", "GET", f"{BASE_URL}/financial-v2/lookups/transaction-types", 200)
    test_endpoint("GET /api/financial-v2/lookups/payment-methods", "GET", f"{BASE_URL}/financial-v2/lookups/payment-methods", 200)
    test_endpoint("GET /api/financial-v2/lookups/currencies", "GET", f"{BASE_URL}/financial-v2/lookups/currencies", 200)
    
    # 5. TRANSACTION TESTS
    print("\n--- TRANSACTION TESTS ---")
    
    test_endpoint("GET /api/financial-transactions", "GET", f"{BASE_URL}/financial-transactions", 200)
    
    # 6. REPORT TESTS
    print("\n--- REPORT TESTS ---")
    
    test_endpoint(
        "GET /api/reports/profit-loss",
        "GET",
        f"{BASE_URL}/reports/profit-loss?start_date=2024-01-01&end_date=2025-12-31",
        200
    )
    
    test_endpoint(
        "GET /api/reports/unified-ledger",
        "GET",
        f"{BASE_URL}/reports/unified-ledger",
        200
    )
    
    # 7. CASH TESTS
    print("\n--- CASH TESTS ---")
    
    test_endpoint("GET /api/cash-registers", "GET", f"{BASE_URL}/cash-registers", 200)
    test_endpoint("GET /api/cash-movements", "GET", f"{BASE_URL}/cash-movements", 200)
    
    # 8. MARKET DATA TEST
    print("\n--- MARKET DATA TEST ---")
    
    test_endpoint("GET /api/market-data/latest", "GET", f"{BASE_URL}/market-data/latest", 200)
    
    # 9. STOCK TESTS
    print("\n--- STOCK TESTS ---")
    
    test_endpoint("GET /api/products/stock/summary", "GET", f"{BASE_URL}/products/stock/summary", 200)
    test_endpoint("GET /api/stock-lots", "GET", f"{BASE_URL}/stock-lots", 200)
    test_endpoint("GET /api/stock-pools", "GET", f"{BASE_URL}/stock-pools", 200)
    
    # 10. USER TESTS
    print("\n--- USER TESTS ---")
    
    test_endpoint("GET /api/users", "GET", f"{BASE_URL}/users", 200)
    
    # SUMMARY
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for r in RESULTS if "PASSED" in r["status"])
    failed = sum(1 for r in RESULTS if "FAILED" in r["status"] or "ERROR" in r["status"])
    total = len(RESULTS)
    
    print(f"\n✅ Passed: {passed}/{total}")
    print(f"❌ Failed: {failed}/{total}")
    print(f"📈 Success Rate: {passed/total*100:.1f}%")
    
    if failed > 0:
        print("\n❌ FAILED TESTS:")
        for r in RESULTS:
            if "FAILED" in r["status"] or "ERROR" in r["status"]:
                print(f"   - {r['name']}: {r.get('actual', r.get('error', 'Unknown'))}")
    
    print("\n" + "="*60)
    
    return passed == total

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)

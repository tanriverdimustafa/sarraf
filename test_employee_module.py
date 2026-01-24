#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend_test import KuyumcuAPITester

def main():
    """Run only the employee management tests"""
    tester = KuyumcuAPITester()
    
    print("🎯 RUNNING EMPLOYEE MANAGEMENT MODULE TEST")
    print("=" * 60)
    
    # Run the employee management test
    success = tester.test_kuyumculuk_personel_modulu()
    
    # Print final summary
    print("\n" + "=" * 60)
    print("📊 EMPLOYEE MODULE TEST SUMMARY")
    print("=" * 60)
    print(f"Total Tests: {tester.tests_run}")
    print(f"Passed: {tester.tests_passed}")
    print(f"Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    # Print failed tests
    failed_tests = [test for test in tester.test_results if not test['success']]
    if failed_tests:
        print("\n❌ FAILED TESTS:")
        for test in failed_tests:
            print(f"  - {test['test']}: {test['details']}")
    else:
        print("\n🎉 ALL EMPLOYEE TESTS PASSED!")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
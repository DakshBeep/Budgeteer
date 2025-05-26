#!/usr/bin/env python3
"""
Comprehensive system test for Budgeteer application
Tests all major functionality including insights
"""
import requests
import time
import sys
from datetime import date, timedelta
import random

BASE_URL = "http://localhost:8000"
TEST_USER = f"testuser_{int(time.time())}"
TEST_PASS = "testpass123"

def print_test(name, passed):
    """Print test result"""
    if passed:
        print(f"✅ {name}")
    else:
        print(f"❌ {name}")
        sys.exit(1)

def test_backend_health():
    """Test if backend is accessible"""
    try:
        # First, let's start the backend
        import subprocess
        import os
        
        # Kill any existing process on port 8000
        os.system("kill -9 $(lsof -t -i:8000) 2>/dev/null")
        time.sleep(1)
        
        # Start backend
        env = os.environ.copy()
        env["JWT_SECRET"] = "test-secret-key"
        process = subprocess.Popen(
            ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # Wait for backend to start
        time.sleep(5)
        
        response = requests.get(f"{BASE_URL}/")
        return response.status_code == 200, process
    except Exception as e:
        print(f"Backend health check failed: {e}")
        return False, None

def test_user_registration():
    """Test user registration"""
    try:
        response = requests.post(
            f"{BASE_URL}/register",
            data={"username": TEST_USER, "password": TEST_PASS}
        )
        return response.status_code == 200 and "id" in response.json()
    except Exception as e:
        print(f"Registration failed: {e}")
        return False

def test_user_login():
    """Test user login and get token"""
    try:
        response = requests.post(
            f"{BASE_URL}/login",
            data={"username": TEST_USER, "password": TEST_PASS}
        )
        if response.status_code == 200:
            data = response.json()
            return "token" in data, data.get("token")
        return False, None
    except Exception as e:
        print(f"Login failed: {e}")
        return False, None

def test_set_budget(token):
    """Test setting a budget goal"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(
            f"{BASE_URL}/goal?amount=2000",
            headers=headers
        )
        return response.status_code == 200
    except Exception as e:
        print(f"Budget setting failed: {e}")
        return False

def test_add_transactions(token):
    """Test adding various transactions"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        transactions = [
            {"tx_date": str(date.today()), "amount": 1500, "label": "Income", "notes": "Monthly salary"},
            {"tx_date": str(date.today() - timedelta(days=1)), "amount": -45.99, "label": "Food & Dining", "notes": "Restaurant"},
            {"tx_date": str(date.today() - timedelta(days=2)), "amount": -120, "label": "Shopping", "notes": "Clothes"},
            {"tx_date": str(date.today() - timedelta(days=3)), "amount": -45.99, "label": "Food & Dining", "notes": "Restaurant duplicate?"},
            {"tx_date": str(date.today() - timedelta(days=5)), "amount": -15, "label": "Entertainment", "notes": "Movie"},
            {"tx_date": str(date.today() - timedelta(days=7)), "amount": -200, "label": "Bills & Utilities", "notes": "Electric bill"},
            {"tx_date": str(date.today() - timedelta(days=10)), "amount": -50, "label": "Transportation", "notes": "Gas"},
            {"tx_date": str(date.today() - timedelta(days=15)), "amount": -300, "label": "Entertainment", "notes": "Concert tickets - unusual!"},
        ]
        
        success_count = 0
        for tx in transactions:
            response = requests.post(
                f"{BASE_URL}/tx",
                json=tx,
                headers=headers
            )
            if response.status_code == 200:
                success_count += 1
                
        return success_count == len(transactions)
    except Exception as e:
        print(f"Transaction creation failed: {e}")
        return False

def test_get_transactions(token):
    """Test retrieving transactions"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/tx", headers=headers)
        return response.status_code == 200 and len(response.json()) > 0
    except Exception as e:
        print(f"Transaction retrieval failed: {e}")
        return False

def test_generate_insights(token):
    """Test insight generation"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(
            f"{BASE_URL}/insights/generate",
            headers=headers
        )
        return response.status_code == 200
    except Exception as e:
        print(f"Insight generation failed: {e}")
        return False

def test_get_insights(token):
    """Test retrieving insights"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        # Wait a bit for insights to be generated
        time.sleep(2)
        response = requests.get(f"{BASE_URL}/insights", headers=headers)
        if response.status_code == 200:
            insights = response.json()
            return len(insights) > 0
        return False
    except Exception as e:
        print(f"Insight retrieval failed: {e}")
        return False

def test_health_score(token):
    """Test financial health score"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/insights/health-score", headers=headers)
        if response.status_code == 200:
            data = response.json()
            return "score" in data and 0 <= data["score"] <= 100
        return False
    except Exception as e:
        print(f"Health score failed: {e}")
        return False

def test_analytics(token):
    """Test analytics endpoints"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        endpoints = [
            "/analytics/summary",
            "/analytics/category-breakdown",
            "/analytics/trends",
            "/analytics/cashflow"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
            if response.status_code != 200:
                return False
        return True
    except Exception as e:
        print(f"Analytics test failed: {e}")
        return False

def test_what_if_scenario(token):
    """Test what-if scenario calculator"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(
            f"{BASE_URL}/insights/what-if",
            json={"category": "Food & Dining", "reduction_percentage": 20},
            headers=headers
        )
        if response.status_code == 200:
            data = response.json()
            return "monthly_savings" in data and "annual_savings" in data
        return False
    except Exception as e:
        print(f"What-if scenario failed: {e}")
        return False

def test_user_preferences(token):
    """Test user preferences"""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        # Get preferences
        response = requests.get(f"{BASE_URL}/insights/preferences", headers=headers)
        if response.status_code != 200:
            return False
            
        # Update preferences
        response = requests.put(
            f"{BASE_URL}/insights/preferences",
            json={"email_digest_frequency": "daily"},
            headers=headers
        )
        return response.status_code == 200
    except Exception as e:
        print(f"Preferences test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Budgeteer Comprehensive System Test\n")
    
    # Test backend
    print("Testing Backend...")
    backend_ok, process = test_backend_health()
    print_test("Backend is accessible", backend_ok)
    
    if not backend_ok:
        print("\n❌ Backend is not running. Please start it with: uvicorn main:app --reload")
        return
    
    # Test user management
    print("\nTesting User Management...")
    print_test("User registration", test_user_registration())
    
    login_ok, token = test_user_login()
    print_test("User login", login_ok)
    
    if not token:
        print("\n❌ Cannot proceed without authentication token")
        if process:
            process.terminate()
        return
    
    # Test core functionality
    print("\nTesting Core Features...")
    print_test("Set budget goal", test_set_budget(token))
    print_test("Add transactions", test_add_transactions(token))
    print_test("Retrieve transactions", test_get_transactions(token))
    
    # Test insights
    print("\nTesting Insights Engine...")
    print_test("Generate insights", test_generate_insights(token))
    print_test("Retrieve insights", test_get_insights(token))
    print_test("Financial health score", test_health_score(token))
    print_test("What-if scenarios", test_what_if_scenario(token))
    
    # Test analytics
    print("\nTesting Analytics...")
    print_test("Analytics endpoints", test_analytics(token))
    
    # Test preferences
    print("\nTesting User Preferences...")
    print_test("User preferences", test_user_preferences(token))
    
    print("\n✅ All tests passed! The system is working correctly.")
    print(f"\n📝 Test user created: {TEST_USER}")
    print("🌐 You can now access the frontend at http://localhost:5173")
    print("   Use the test credentials to login and explore!")
    
    # Cleanup
    if process:
        process.terminate()

if __name__ == "__main__":
    main()
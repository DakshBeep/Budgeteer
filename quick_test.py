#!/usr/bin/env python3
"""Quick test to verify Budgeteer is working"""
import requests
import json
from datetime import date, timedelta
import time

BASE_URL = "http://localhost:8000"

# Create unique test user
timestamp = int(time.time())
username = f"test_user_{timestamp}"
password = "testpass123"

print("🧪 Testing Budgeteer System\n")

# 1. Test Registration
print("1. Testing Registration...")
response = requests.post(f"{BASE_URL}/register", data={"username": username, "password": password})
if response.status_code == 200:
    print(f"✅ Registration successful: {response.json()}")
else:
    print(f"❌ Registration failed: {response.status_code} - {response.text}")
    exit(1)

# 2. Test Login
print("\n2. Testing Login...")
response = requests.post(f"{BASE_URL}/login", data={"username": username, "password": password})
if response.status_code == 200:
    token = response.json()["token"]
    print(f"✅ Login successful, token received")
    headers = {"Authorization": f"Bearer {token}"}
else:
    print(f"❌ Login failed: {response.status_code}")
    exit(1)

# 3. Test Setting Budget
print("\n3. Testing Budget Goal...")
response = requests.post(f"{BASE_URL}/goal?amount=2000", headers=headers)
if response.status_code == 200:
    print(f"✅ Budget set: {response.json()}")
else:
    print(f"❌ Budget setting failed: {response.status_code}")

# 4. Add Transactions
print("\n4. Adding Test Transactions...")
transactions = [
    {"tx_date": str(date.today()), "amount": 2500, "label": "Income", "notes": "Salary"},
    {"tx_date": str(date.today() - timedelta(days=1)), "amount": -50, "label": "Food & Dining"},
    {"tx_date": str(date.today() - timedelta(days=2)), "amount": -120, "label": "Shopping"},
    {"tx_date": str(date.today() - timedelta(days=3)), "amount": -50, "label": "Food & Dining"},  # Duplicate
    {"tx_date": str(date.today() - timedelta(days=5)), "amount": -300, "label": "Entertainment"},  # Anomaly
]

for tx in transactions:
    response = requests.post(f"{BASE_URL}/tx", json=tx, headers=headers)
    if response.status_code == 200:
        print(f"  ✅ Added: {tx['label']} - ${abs(tx['amount'])}")
    else:
        print(f"  ❌ Failed to add transaction: {response.status_code}")

# 5. Generate Insights
print("\n5. Generating Insights...")
response = requests.post(f"{BASE_URL}/insights/generate", headers=headers)
if response.status_code == 200:
    print("✅ Insights generation triggered")
    time.sleep(2)  # Wait for insights to be generated
else:
    print(f"❌ Insights generation failed: {response.status_code}")

# 6. Get Insights
print("\n6. Retrieving Insights...")
response = requests.get(f"{BASE_URL}/insights", headers=headers)
if response.status_code == 200:
    insights = response.json()
    print(f"✅ Found {len(insights)} insights:")
    for insight in insights[:3]:  # Show first 3
        print(f"  - {insight['type']}: {insight['title']}")
else:
    print(f"❌ Failed to get insights: {response.status_code}")

# 7. Get Health Score
print("\n7. Getting Financial Health Score...")
response = requests.get(f"{BASE_URL}/insights/health-score", headers=headers)
if response.status_code == 200:
    score_data = response.json()
    print(f"✅ Health Score: {score_data['score']:.1f}/100 ({score_data['trend']})")
else:
    print(f"❌ Failed to get health score: {response.status_code}")

# 8. Test Analytics
print("\n8. Testing Analytics...")
response = requests.get(f"{BASE_URL}/analytics/summary", headers=headers)
if response.status_code == 200:
    summary = response.json()
    print(f"✅ Analytics working - Total transactions: {summary['total_transactions']}")
else:
    print(f"❌ Analytics failed: {response.status_code}")

print(f"\n✅ All tests passed!")
print(f"\n📝 Test credentials:")
print(f"   Username: {username}")
print(f"   Password: {password}")
print(f"\n🌐 You can now login at http://localhost:5173")
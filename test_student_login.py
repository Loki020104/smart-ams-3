#!/usr/bin/env python3
"""
Test script to create a student account and verify login works
"""
import requests
import json

backend_url = "http://localhost:6001"

# Test student credentials
test_student = {
    "username": "2024cse0001",
    "password": "student123",
    "full_name": "Test Student",
    "email": "student@example.com",
    "role": "student",
    "roll_no": "2024cse0001",
    "department": "CSE",
    "section": "A"
}

print("=" * 60)
print("CREATING TEST STUDENT ACCOUNT")
print("=" * 60)

try:
    # Register test student
    print("\n1. Creating student account...")
    resp = requests.post(f"{backend_url}/api/users/add", json=test_student)
    print(f"   Status: {resp.status_code}")
    result = resp.json()
    print(f"   Response: {json.dumps(result, indent=2)}")
    
    if resp.status_code == 200 or (resp.status_code == 400 and "already" in str(result)):
        print("\n2. Testing login...")
        login_resp = requests.post(f"{backend_url}/api/users/login", json={
            "username": test_student['username'],
            "password": test_student['password']
        })
        print(f"   Login Status: {login_resp.status_code}")
        login_result = login_resp.json()
        print(f"   Login Response: {json.dumps(login_result, indent=2)}")

        user_info = login_result.get('user', {})
        print(f"   Face registered: {user_info.get('face_registered')}")
        print(f"   Needs face registration: {user_info.get('needs_face_registration')}")
        print(f"   Face verified: {user_info.get('face_verified')}")

        if login_resp.status_code == 200 and login_result.get('success'):
            print("\n✅ SUCCESS! Student can now login with:")
            print(f"   Username: {test_student['username']}")
            print(f"   Password: {test_student['password']}")
        else:
            print("\n❌ Login failed. Check password hashing in backend.")
    else:
        print(f"\n❌ Failed to create student account.")
        
except Exception as e:
    print(f"\n❌ Error: {str(e)}")

print("\n" + "=" * 60)

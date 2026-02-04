import requests
import sys
from datetime import datetime
import json

class SinarmasAPITester:
    def __init__(self, base_url="https://sinarmas-hymne.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.results = []

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)

            success = response.status_code == expected_status
            
            result = {
                "test_name": name,
                "method": method,
                "endpoint": endpoint,
                "expected_status": expected_status,
                "actual_status": response.status_code,
                "success": success,
                "response_data": None,
                "error": None
            }

            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    result["response_data"] = response.json()
                    print(f"Response: {json.dumps(result['response_data'], indent=2)}")
                except:
                    result["response_data"] = response.text
                    print(f"Response: {response.text}")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    result["error"] = response.json()
                    print(f"Error Response: {json.dumps(result['error'], indent=2)}")
                except:
                    result["error"] = response.text
                    print(f"Error Response: {response.text}")

            self.results.append(result)
            return success, result["response_data"] if success else result["error"]

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            result = {
                "test_name": name,
                "method": method,
                "endpoint": endpoint,
                "expected_status": expected_status,
                "actual_status": "ERROR",
                "success": False,
                "response_data": None,
                "error": str(e)
            }
            self.results.append(result)
            return False, str(e)

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test(
            "Root API Endpoint",
            "GET",
            "api/",
            200
        )

    def test_create_activity_log(self):
        """Test creating activity log"""
        test_data = {
            "event_type": "test_event",
            "event_time": datetime.now().strftime("%H:%M:%S"),
            "description": "Test activity log creation"
        }
        
        return self.run_test(
            "Create Activity Log",
            "POST",
            "api/activity-log",
            200,  # Based on the code, it should return 200, not 201
            data=test_data
        )

    def test_get_activity_logs(self):
        """Test retrieving activity logs"""
        return self.run_test(
            "Get Activity Logs",
            "GET",
            "api/activity-log",
            200
        )

    def test_blok_nasional_log(self):
        """Test logging Blok Nasional event"""
        test_data = {
            "event_type": "blok_nasional",
            "event_time": "07:50:00",
            "description": "Blok Nasional dimainkan"
        }
        
        return self.run_test(
            "Log Blok Nasional Event",
            "POST",
            "api/activity-log",
            200,
            data=test_data
        )

    def test_sirine_kerja_log(self):
        """Test logging Sirine Kerja event"""
        test_data = {
            "event_type": "sirine_kerja",
            "event_time": "08:00:00",
            "description": "Sirine kerja dimainkan"
        }
        
        return self.run_test(
            "Log Sirine Kerja Event",
            "POST",
            "api/activity-log",
            200,
            data=test_data
        )

    def test_reminder_log(self):
        """Test logging Reminder event"""
        test_data = {
            "event_type": "reminder",
            "event_time": "09:00:00",
            "description": "Reminder jam dimainkan"
        }
        
        return self.run_test(
            "Log Reminder Event",
            "POST",
            "api/activity-log",
            200,
            data=test_data
        )

    def test_invalid_endpoint(self):
        """Test invalid endpoint"""
        return self.run_test(
            "Invalid Endpoint",
            "GET",
            "api/invalid-endpoint",
            404
        )

    def print_summary(self):
        """Print test summary"""
        print(f"\n" + "="*60)
        print(f"📊 BACKEND API TEST SUMMARY")
        print(f"="*60)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.tests_passed < self.tests_run:
            print(f"\n❌ FAILED TESTS:")
            for result in self.results:
                if not result["success"]:
                    print(f"  - {result['test_name']}: {result['error']}")
        
        return self.tests_passed == self.tests_run

def main():
    print("🚀 Starting Sinarmas Reminder System Backend API Tests")
    print("="*60)
    
    tester = SinarmasAPITester()
    
    # Run all tests
    tests = [
        tester.test_root_endpoint,
        tester.test_create_activity_log,
        tester.test_get_activity_logs,
        tester.test_blok_nasional_log,
        tester.test_sirine_kerja_log,
        tester.test_reminder_log,
        tester.test_invalid_endpoint
    ]
    
    for test in tests:
        test()
    
    # Print summary
    all_passed = tester.print_summary()
    
    # Save results to file
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "total_tests": tester.tests_run,
            "passed_tests": tester.tests_passed,
            "success_rate": (tester.tests_passed/tester.tests_run)*100,
            "results": tester.results
        }, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/backend_test_results.json")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
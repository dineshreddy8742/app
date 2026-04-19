"""
Backend API tests for Scholara School Management System
Tests: Auth, Dashboard, Students, Teachers, Attendance, Fees, Notifications, Leaves
"""
import pytest
import requests
import os

# Use public URL for testing (from frontend/.env)
BASE_URL = "https://scholar-dash-23.preview.emergentagent.com"

# Test credentials from /app/memory/test_credentials.md
ADMIN_CREDS = {"email": "admin@school.com", "password": "admin123"}
TEACHER_CREDS = {"email": "teacher@school.com", "password": "teacher123"}
STUDENT_CREDS = {"email": "student@school.com", "password": "student123"}
PARENT_CREDS = {"email": "parent@school.com", "password": "parent123"}


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestAuth:
    """Authentication endpoint tests"""

    def test_login_admin_success(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == ADMIN_CREDS["email"]

    def test_login_teacher_success(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=TEACHER_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "teacher"

    def test_login_student_success(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=STUDENT_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "student"

    def test_login_parent_success(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=PARENT_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "parent"

    def test_login_invalid_credentials(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@school.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401

    def test_me_endpoint_with_valid_token(self, api_client):
        # Login first
        login_resp = api_client.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        token = login_resp.json()["token"]
        
        # Call /me
        response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == ADMIN_CREDS["email"]
        assert data["role"] == "admin"

    def test_me_endpoint_without_token(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 403  # No auth header


class TestDashboard:
    """Dashboard endpoint tests for all roles"""

    def test_admin_dashboard(self, api_client):
        login_resp = api_client.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        token = login_resp.json()["token"]
        
        response = api_client.get(
            f"{BASE_URL}/api/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "admin"
        assert "metrics" in data
        assert "total_students" in data["metrics"]
        assert "total_teachers" in data["metrics"]
        assert "total_classes" in data["metrics"]

    def test_teacher_dashboard(self, api_client):
        login_resp = api_client.post(f"{BASE_URL}/api/auth/login", json=TEACHER_CREDS)
        token = login_resp.json()["token"]
        
        response = api_client.get(
            f"{BASE_URL}/api/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "teacher"
        assert "teacher" in data
        assert "assigned_classes" in data

    def test_student_dashboard(self, api_client):
        login_resp = api_client.post(f"{BASE_URL}/api/auth/login", json=STUDENT_CREDS)
        token = login_resp.json()["token"]
        
        response = api_client.get(
            f"{BASE_URL}/api/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "student"
        assert "student" in data
        assert "attendance_pct" in data

    def test_parent_dashboard(self, api_client):
        login_resp = api_client.post(f"{BASE_URL}/api/auth/login", json=PARENT_CREDS)
        token = login_resp.json()["token"]
        
        response = api_client.get(
            f"{BASE_URL}/api/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "parent"
        assert "children" in data


class TestStudents:
    """Student CRUD tests"""

    def test_list_students_as_admin(self, api_client):
        login_resp = api_client.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        token = login_resp.json()["token"]
        
        response = api_client.get(
            f"{BASE_URL}/api/students",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_list_students_by_class(self, api_client):
        login_resp = api_client.post(f"{BASE_URL}/api/auth/login", json=TEACHER_CREDS)
        token = login_resp.json()["token"]
        
        response = api_client.get(
            f"{BASE_URL}/api/students?class_name=10-A",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for student in data:
            assert student["class_name"] == "10-A"


class TestTeachers:
    """Teacher list tests"""

    def test_list_teachers(self, api_client):
        login_resp = api_client.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        token = login_resp.json()["token"]
        
        response = api_client.get(
            f"{BASE_URL}/api/teachers",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2  # Seed has 2 teachers


class TestAttendance:
    """Attendance marking and retrieval tests"""

    def test_get_attendance_for_class(self, api_client):
        login_resp = api_client.post(f"{BASE_URL}/api/auth/login", json=TEACHER_CREDS)
        token = login_resp.json()["token"]
        
        response = api_client.get(
            f"{BASE_URL}/api/attendance?class_name=10-A&date_from=2026-04-19&date_to=2026-04-19",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestFees:
    """Fee and payment tests"""

    def test_list_fees_as_student(self, api_client):
        login_resp = api_client.post(f"{BASE_URL}/api/auth/login", json=STUDENT_CREDS)
        token = login_resp.json()["token"]
        
        response = api_client.get(
            f"{BASE_URL}/api/fees",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestNotifications:
    """Notification tests"""

    def test_list_notifications(self, api_client):
        login_resp = api_client.post(f"{BASE_URL}/api/auth/login", json=STUDENT_CREDS)
        token = login_resp.json()["token"]
        
        response = api_client.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestLeaves:
    """Leave request tests"""

    def test_list_leaves_as_student(self, api_client):
        login_resp = api_client.post(f"{BASE_URL}/api/auth/login", json=STUDENT_CREDS)
        token = login_resp.json()["token"]
        
        response = api_client.get(
            f"{BASE_URL}/api/leaves",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

from unittest.mock import patch

from django.test import TestCase
from django.core.cache import cache
from rest_framework.test import APIClient

from users.models import CustomUser, UserRole


class AuthFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.visitor_role, _ = UserRole.objects.get_or_create(name="مراجعه‌کننده", slug="visitor")

    def test_request_otp_probe_reports_password_state_for_existing_user(self):
        CustomUser.objects.create_user(
            phone_number="09120000021",
            password="StrongPass123!",
            role=self.visitor_role,
        )

        response = self.client.post(
            "/api/auth/request-otp/",
            {"phone_number": "09120000021", "send_otp": False},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user_exists"], True)
        self.assertEqual(response.data["has_password"], True)
        self.assertEqual(response.data["requires_otp"], False)
        self.assertEqual(response.data["otp_sent"], False)

    @patch("users.views.otp_service.verify_otp", return_value=True)
    def test_verify_otp_returns_signup_token_for_new_user(self, _verify_otp):
        response = self.client.post(
            "/api/auth/verify-otp/",
            {"phone_number": "09120000022", "otp_code": "654321"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["requires_signup"], True)
        self.assertIn("signup_token", response.data)

    @patch("users.views.otp_service.verify_otp", return_value=True)
    def test_complete_signup_creates_user_and_tokens(self, _verify_otp):
        verify_response = self.client.post(
            "/api/auth/verify-otp/",
            {"phone_number": "09120000023", "otp_code": "654321"},
            format="json",
        )
        signup_token = verify_response.data["signup_token"]

        response = self.client.post(
            "/api/auth/complete-signup/",
            {
                "signup_token": signup_token,
                "full_name": "New Visitor",
                "email": "newvisitor@example.com",
                "password": "StrongPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertIn("access", response.data)
        self.assertTrue(CustomUser.objects.filter(phone_number="09120000023").exists())

    @patch("users.views.otp_service.send_otp")
    def test_request_otp_send_mode_dispatches_otp(self, mock_send_otp):
        response = self.client.post(
            "/api/auth/request-otp/",
            {"phone_number": "09120000024", "send_otp": True},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        mock_send_otp.assert_called_once_with("09120000024")

    def test_verify_otp_accepts_persian_digits(self):
        cache.set("otp_09120000025", "654321", 300)

        response = self.client.post(
            "/api/auth/verify-otp/",
            {"phone_number": "09120000025", "otp_code": "۶۵۴۳۲۱"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["requires_signup"], True)
        self.assertIn("signup_token", response.data)

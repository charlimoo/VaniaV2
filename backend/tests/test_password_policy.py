from django.test import TestCase
from rest_framework.test import APIClient
from unittest.mock import patch

from users.models import CustomUser, UserRole


class PasswordPolicyTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.visitor_role, _ = UserRole.objects.get_or_create(name="مراجعه‌کننده", slug="visitor")

    @patch("users.views.otp_service.verify_otp", return_value=True)
    def test_complete_signup_rejects_weak_signup_password(self, _verify_otp):
        phone_number = "09120000011"

        verify_response = self.client.post(
            "/api/auth/verify-otp/",
            {"phone_number": phone_number, "otp_code": "654321"},
            format="json",
        )

        self.assertEqual(verify_response.status_code, 200)
        signup_token = verify_response.json()["signup_token"]

        response = self.client.post(
            "/api/auth/complete-signup/",
            {
                "signup_token": signup_token,
                "password": "abcdef12",
                "full_name": "Visitor Signup",
                "email": "signup@example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        body = response.json()
        self.assertIn("password", body)
        self.assertTrue(any("نشانه" in message for message in body["password"]))
        self.assertFalse(CustomUser.objects.filter(phone_number=phone_number).exists())

    def test_profile_patch_rejects_weak_password(self):
        user = CustomUser.objects.create_user(
            phone_number="09120000012",
            role=self.visitor_role,
            full_name="Visitor User",
        )

        self.client.force_authenticate(user)
        response = self.client.patch(
            "/api/auth/profile/",
            {"password": "abcdef12"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        body = response.json()
        self.assertIn("password", body)
        self.assertTrue(any("نشانه" in message for message in body["password"]))

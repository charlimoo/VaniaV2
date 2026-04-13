from django.test import TestCase
from rest_framework.test import APIClient

from users.models import CustomUser, UserRole


class PasswordPolicyTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.visitor_role, _ = UserRole.objects.get_or_create(name="مراجعه‌کننده", slug="visitor")

    def test_verify_otp_rejects_weak_signup_password(self):
        phone_number = "09120000011"

        response = self.client.post(
            "/api/auth/verify-otp/",
            {
                "phone_number": phone_number,
                "otp_code": "123456",
                "signup_data": {
                    "password": "abcdef12",
                    "fullName": "Visitor Signup",
                    "email": "signup@example.com",
                },
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        body = response.json()
        self.assertIn("signup_data", body)
        self.assertIn("password", body["signup_data"])
        self.assertTrue(any("نشانه" in message for message in body["signup_data"]["password"]))
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

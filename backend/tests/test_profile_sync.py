from django.test import TestCase
from rest_framework.test import APIClient

from users.models import CustomUser, UserRole
from vania_core.case_service import CaseService


class VisitorProfileSyncTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.visitor_role = UserRole.objects.create(name="مراجعه‌کننده", slug="visitor")

    def test_signup_copies_name_and_email_into_base_profile(self):
        response = self.client.post(
            "/api/auth/verify-otp/",
            {
                "phone_number": "09120000001",
                "otp_code": "123456",
                "signup_data": {
                    "password": "StrongPass123!",
                    "fullName": "Visitor Signup",
                    "email": "Signup@Test.com",
                },
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        user = CustomUser.objects.get(phone_number="09120000001")
        entry = CaseService.get_latest_base_profile_entry(user)

        self.assertIsNotNone(entry)
        self.assertEqual(entry.data.get("full_name"), "Visitor Signup")
        self.assertEqual(entry.data.get("email"), "signup@test.com")

    def test_profile_patch_updates_existing_base_profile_identity_fields(self):
        user = CustomUser.objects.create_user(
            phone_number="09120000002",
            full_name="Old Name",
            email="old@example.com",
            role=self.visitor_role,
        )
        CaseService.save_base_profile(
            user,
            {
                "full_name": "Old Name",
                "email": "old@example.com",
                "birth_date": "1370/01/01",
            },
            creator=user,
        )

        self.client.force_authenticate(user)
        response = self.client.patch(
            "/api/auth/profile/",
            {
                "full_name": "New Name",
                "email": "NewEmail@example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        entry = CaseService.get_latest_base_profile_entry(user)

        self.assertIsNotNone(entry)
        self.assertEqual(entry.data.get("full_name"), "New Name")
        self.assertEqual(entry.data.get("email"), "newemail@example.com")
        self.assertEqual(entry.data.get("birth_date"), "1370/01/01")

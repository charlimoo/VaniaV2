from django.test import TestCase
from rest_framework.test import APIClient
from unittest.mock import patch

from users.models import CustomUser, UserRole
from vania_core.case_service import CaseService
from vania_core.profile_snapshots import format_visitor_profile_context, get_user_agent_profile_payload


class VisitorProfileSyncTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.visitor_role = UserRole.objects.create(name="مراجعه‌کننده", slug="visitor")
        self.expert_role = UserRole.objects.create(name="متخصص", slug="expert")

    @patch("users.views.otp_service.verify_otp", return_value=True)
    def test_signup_copies_name_and_email_into_base_profile(self, _verify_otp):
        verify_response = self.client.post(
            "/api/auth/verify-otp/",
            {"phone_number": "09120000001", "otp_code": "654321"},
            format="json",
        )

        self.assertEqual(verify_response.status_code, 200)
        signup_token = verify_response.json()["signup_token"]

        response = self.client.post(
            "/api/auth/complete-signup/",
            {
                "signup_token": signup_token,
                "password": "StrongPass123!",
                "full_name": "Visitor Signup",
                "email": "Signup@Test.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
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

    def test_expert_can_get_and_patch_my_base_profile(self):
        user = CustomUser.objects.create_user(
            phone_number="09120000003",
            full_name="Expert User",
            email="expert@example.com",
            role=self.expert_role,
        )
        CaseService.save_base_profile(
            user,
            {
                "full_name": "Expert User",
                "email": "expert@example.com",
                "birth_date": "1372/02/02",
            },
            creator=user,
        )

        self.client.force_authenticate(user)
        get_response = self.client.get("/api/vania/my-base-profile/")
        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(get_response.data["data"].get("birth_date"), "1372/02/02")

        patch_response = self.client.patch(
            "/api/vania/my-base-profile/",
            {"birth_date": "1373/03/03", "full_name": "Expert Updated"},
            format="json",
        )
        self.assertEqual(patch_response.status_code, 200)
        entry = CaseService.get_latest_base_profile_entry(user)
        self.assertEqual(entry.data.get("birth_date"), "1373/03/03")
        self.assertEqual(entry.data.get("full_name"), "Expert Updated")

    def test_profile_patch_still_syncs_base_identity_after_role_upgrade(self):
        user = CustomUser.objects.create_user(
            phone_number="09120000004",
            full_name="Before Upgrade",
            email="before@example.com",
            role=self.expert_role,
        )
        CaseService.save_base_profile(
            user,
            {
                "full_name": "Before Upgrade",
                "email": "before@example.com",
                "birth_date": "1370/01/01",
            },
            creator=user,
        )

        self.client.force_authenticate(user)
        response = self.client.patch(
            "/api/auth/profile/",
            {
                "full_name": "After Upgrade",
                "email": "After@Example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        entry = CaseService.get_latest_base_profile_entry(user)
        self.assertEqual(entry.data.get("full_name"), "After Upgrade")
        self.assertEqual(entry.data.get("email"), "after@example.com")
        self.assertEqual(entry.data.get("birth_date"), "1370/01/01")

    def test_visitor_profile_context_contains_family_history_payload(self):
        user = CustomUser.objects.create_user(
            phone_number="09120000005",
            full_name="Payload User",
            role=self.visitor_role,
        )
        CaseService.save_base_profile(
            user,
            {
                "full_name": "Payload User",
                "family_history": [
                    {"name": "Parent", "relation": "پدر"},
                ],
            },
            creator=user,
        )

        lines = format_visitor_profile_context(user)
        merged = "\n".join(lines)
        self.assertIn("family_history", merged)

    def test_full_agent_profile_includes_complete_base_profile_shape(self):
        user = CustomUser.objects.create_user(
            phone_number="09120000006",
            full_name="Payload User",
            role=self.visitor_role,
        )
        CaseService.save_base_profile(
            user,
            {
                "full_name": "Payload User",
                "family_history": [
                    {"name": "Parent", "relation": "پدر"},
                ],
            },
            creator=user,
        )

        payload = get_user_agent_profile_payload(user)
        visitor_profile = payload["visitor_profile"]

        self.assertIn("family_history", visitor_profile)
        self.assertEqual(visitor_profile["family_history"][0]["name"], "Parent")
        self.assertIn("referral_source", visitor_profile)
        self.assertIn("marital_status", visitor_profile)

    def test_save_base_profile_merges_partial_updates_instead_of_wiping_existing_fields(self):
        user = CustomUser.objects.create_user(
            phone_number="09120000007",
            full_name="Merge User",
            role=self.visitor_role,
        )
        CaseService.save_base_profile(
            user,
            {
                "full_name": "Merge User",
                "family_history": [{"name": "Mother", "relation": "مادر"}],
                "education_level": "کارشناسی",
            },
            creator=user,
        )

        CaseService.save_base_profile(
            user,
            {
                "full_name": "Merge User Updated",
            },
            creator=user,
        )

        entry = CaseService.get_latest_base_profile_entry(user)
        self.assertIsNotNone(entry)
        self.assertEqual(entry.data.get("full_name"), "Merge User Updated")
        self.assertEqual(entry.data.get("education_level"), "کارشناسی")
        self.assertEqual(entry.data.get("family_history")[0]["name"], "Mother")

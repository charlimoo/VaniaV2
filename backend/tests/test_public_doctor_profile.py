from django.test import TestCase
from rest_framework.test import APIClient

from users.models import CustomUser, UserRole
from vania_core.models import DoctorProfile, Location


class PublicDoctorProfileTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.visitor_role = UserRole.objects.create(slug="visitor", name="مراجع")
        self.expert_role = UserRole.objects.create(slug="expert", name="متخصص")
        self.viewer = CustomUser.objects.create_user(
            phone_number="09120001000",
            full_name="مراجع",
            role=self.visitor_role,
        )
        self.expert = CustomUser.objects.create_user(
            phone_number="09120001001",
            full_name="متخصص کامل",
            role=self.expert_role,
            is_expert_verified=True,
        )
        self.location = Location.objects.create(name="تهران")

    def _directory_items(self, response):
        data = response.data
        if isinstance(data, dict) and "results" in data:
            return data["results"]
        return data

    def test_directory_hides_public_expert_until_required_profile_fields_are_complete(self):
        incomplete_expert = CustomUser.objects.create_user(
            phone_number="09120001002",
            full_name="متخصص ناقص",
            role=self.expert_role,
            is_expert_verified=True,
        )
        incomplete_profile = DoctorProfile.objects.create(
            user=incomplete_expert,
            is_public=True,
            specialty="روانشناس بالینی",
        )
        complete_profile = DoctorProfile.objects.create(
            user=self.expert,
            is_public=True,
            specialty="روانشناس بالینی",
            location=self.location,
            clinic_address="تهران، خیابان ولیعصر، پلاک ۱۰",
            bio="من در حوزه سلامت روان بزرگسالان فعالیت می‌کنم.",
        )

        self.client.force_authenticate(self.viewer)
        response = self.client.get("/api/vania/experts/")

        self.assertEqual(response.status_code, 200)
        ids = {item["id"] for item in self._directory_items(response)}
        self.assertIn(complete_profile.id, ids)
        self.assertNotIn(incomplete_profile.id, ids)

    def test_expert_cannot_enable_public_listing_with_incomplete_profile(self):
        DoctorProfile.objects.create(user=self.expert, is_public=False)

        self.client.force_authenticate(self.expert)
        response = self.client.patch(
            "/api/vania/my-profile/",
            {
                "is_public": "True",
                "specialty": "روانشناس بالینی",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("is_public", response.data)

    def test_incomplete_public_expert_cannot_keep_public_listing_on_profile_update(self):
        DoctorProfile.objects.create(
            user=self.expert,
            is_public=True,
            specialty="روانشناس بالینی",
        )

        self.client.force_authenticate(self.expert)
        response = self.client.patch(
            "/api/vania/my-profile/",
            {"accepting_new_patients": "False"},
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("is_public", response.data)

    def test_expert_can_enable_public_listing_after_required_profile_fields_are_complete(self):
        DoctorProfile.objects.create(user=self.expert, is_public=False)

        self.client.force_authenticate(self.expert)
        response = self.client.patch(
            "/api/vania/my-profile/",
            {
                "is_public": "True",
                "specialty": "روانشناس بالینی",
                "location_id": str(self.location.id),
                "clinic_address": "تهران، خیابان ولیعصر، پلاک ۱۰",
                "bio": "من در حوزه سلامت روان بزرگسالان فعالیت می‌کنم.",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        self.expert.doctor_profile.refresh_from_db()
        self.assertTrue(self.expert.doctor_profile.is_public)

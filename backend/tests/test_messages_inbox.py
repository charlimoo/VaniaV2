from django.test import TestCase
from rest_framework.test import APIClient

from users.models import CustomUser, ExpertProfession, UserRole
from vania_core.models import TreatmentConnection


class MessagesInboxTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.expert_role = UserRole.objects.create(name="متخصص", slug="expert")
        self.visitor_role = UserRole.objects.create(name="مراجعه‌کننده", slug="visitor")
        self.profession = ExpertProfession.objects.create(slug="psychologist", name="روانشناس")

        self.patient = CustomUser.objects.create_user(
            phone_number="3000000001",
            role=self.visitor_role,
            full_name="Patient User",
        )
        self.verified_expert = CustomUser.objects.create_user(
            phone_number="3000000002",
            role=self.expert_role,
            full_name="Verified Expert",
            expert_profession=self.profession,
            is_expert_verified=True,
        )
        self.visitor_in_doctor_slot = CustomUser.objects.create_user(
            phone_number="3000000003",
            role=self.visitor_role,
            full_name="Wrong Slot Visitor",
        )

        TreatmentConnection.objects.create(
            doctor=self.verified_expert,
            patient=self.patient,
            status=TreatmentConnection.Status.ACTIVE,
        )
        TreatmentConnection.objects.create(
            doctor=self.visitor_in_doctor_slot,
            patient=self.patient,
            status=TreatmentConnection.Status.ACTIVE,
        )

    def test_inbox_can_filter_counterpart_to_verified_experts(self):
        self.client.force_authenticate(self.patient)

        all_response = self.client.get("/api/vania/messages/inbox/")
        self.assertEqual(all_response.status_code, 200)
        self.assertEqual(
            {item["user_id"] for item in all_response.json()},
            {self.verified_expert.id, self.visitor_in_doctor_slot.id},
        )

        expert_response = self.client.get("/api/vania/messages/inbox/", {"counterpart_role": "expert"})
        self.assertEqual(expert_response.status_code, 200)
        self.assertEqual([item["user_id"] for item in expert_response.json()], [self.verified_expert.id])
        self.assertEqual(expert_response.json()[0]["role_slug"], "expert")
        self.assertTrue(expert_response.json()[0]["is_expert_verified"])

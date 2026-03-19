from django.test import TestCase
from rest_framework.test import APIClient

from users.models import CustomUser, ExpertProfession, UserRole
from vania_core.case_service import CaseService
from vania_core.models import TreatmentConnection
from vania_core.patient_service import PatientDataService
from vania_core.tests_service import ClinicalTestsService


class CasePermissionsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.expert_role = UserRole.objects.create(name="متخصص", slug="expert")
        self.visitor_role = UserRole.objects.create(name="مراجعه‌کننده", slug="visitor")
        self.psychologist = ExpertProfession.objects.create(slug="psychologist", name="روانشناس")
        self.lawyer = ExpertProfession.objects.create(slug="lawyer", name="وکیل")

        self.owner = CustomUser.objects.create_user(
            phone_number="1000000001",
            role=self.expert_role,
            full_name="Owner Expert",
            expert_profession=self.psychologist,
            is_expert_verified=True,
        )
        self.shared_reader = CustomUser.objects.create_user(
            phone_number="1000000002",
            role=self.expert_role,
            full_name="Shared Reader",
            expert_profession=self.psychologist,
            is_expert_verified=True,
        )
        self.other_type_expert = CustomUser.objects.create_user(
            phone_number="1000000003",
            role=self.expert_role,
            full_name="Other Type",
            expert_profession=self.lawyer,
            is_expert_verified=True,
        )
        self.visitor = CustomUser.objects.create_user(
            phone_number="2000000001",
            role=self.visitor_role,
            full_name="Visitor User",
        )

        for expert in [self.owner, self.shared_reader, self.other_type_expert]:
            TreatmentConnection.objects.create(
                doctor=expert,
                patient=self.visitor,
                status=TreatmentConnection.Status.ACTIVE,
            )

        self.case = CaseService.create_case(self.visitor, self.owner, "پرونده اصلی")
        self.test_entry = ClinicalTestsService.add_test(
            patient=self.visitor,
            created_by=self.owner,
            title="Test A",
            result_summary="Initial result",
            doctor_id=self.owner.id,
            case_id=self.case["id"],
        )

    def test_shared_case_is_visible_read_only_and_visitor_snapshot_has_profession(self):
        self.client.force_authenticate(self.visitor)
        share_response = self.client.post(
            f"/api/vania/cases/{self.case['id']}/shares/",
            {"expert_id": self.shared_reader.id},
            format="json",
        )
        self.assertEqual(share_response.status_code, 201)

        visitor_snapshot = PatientDataService.get_patient_dashboard_snapshot(self.visitor, case_id=self.case["id"])
        self.assertEqual(visitor_snapshot["cases"][0]["doctor_profession_label"], "روانشناس")

        accessible_for_reader = CaseService.get_accessible_cases_for_expert(self.visitor, self.shared_reader)
        shared_case = next(item for item in accessible_for_reader if item["id"] == self.case["id"])
        self.assertTrue(shared_case["is_read_only"])
        self.assertFalse(shared_case["can_edit"])

    def test_visitor_can_only_share_with_same_profession(self):
        self.client.force_authenticate(self.visitor)
        response = self.client.post(
            f"/api/vania/cases/{self.case['id']}/shares/",
            {"expert_id": self.other_type_expert.id},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("same type", response.json()["error"])

    def test_shared_expert_can_read_but_cannot_modify_case_tests(self):
        self.client.force_authenticate(self.visitor)
        self.client.post(
            f"/api/vania/cases/{self.case['id']}/shares/",
            {"expert_id": self.shared_reader.id},
            format="json",
        )

        self.client.force_authenticate(self.shared_reader)
        get_response = self.client.get(
            "/api/vania/tests/",
            {"patient_id": self.visitor.id, "case_id": self.case["id"]},
        )
        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(len(get_response.json()["tests"]), 1)

        put_response = self.client.put(
            f"/api/vania/tests/{self.test_entry['id']}/",
            {
                "patient_id": self.visitor.id,
                "case_id": self.case["id"],
                "result_text": "mutated",
            },
            format="json",
        )
        self.assertEqual(put_response.status_code, 403)

from django.test import TestCase

from agents.context import resource_context, selected_doctor_context
from agents.profile_context import build_default_profile_context
from users.models import CustomUser, ExpertProfession, UserRole
from vania_core.case_service import CaseService
from vania_core.models import DoctorProfile, TreatmentConnection


class AgentProfileContextTests(TestCase):
    def setUp(self):
        self.visitor_role = UserRole.objects.create(name="مراجعه‌کننده", slug="visitor")
        self.expert_role = UserRole.objects.create(name="متخصص", slug="expert")
        self.profession = ExpertProfession.objects.create(slug="psychologist", name="روانشناس")

        self.visitor = CustomUser.objects.create_user(
            phone_number="09120000111",
            full_name="Visitor User",
            role=self.visitor_role,
            email="visitor@example.com",
        )
        self.expert = CustomUser.objects.create_user(
            phone_number="09120000112",
            full_name="Expert User",
            role=self.expert_role,
            email="expert@example.com",
            expert_profession=self.profession,
        )
        DoctorProfile.objects.create(
            user=self.expert,
            specialty="CBT",
            clinic_address="Tehran Clinic",
        )
        TreatmentConnection.objects.create(
            doctor=self.expert,
            patient=self.visitor,
            status=TreatmentConnection.Status.ACTIVE,
        )
        CaseService.save_base_profile(
            self.visitor,
            {
                "full_name": "Visitor User",
                "birth_date": "1375/01/01",
                "education_level": "کارشناسی",
                "job_title": "Designer",
                "marital_status": "مجرد",
            },
            creator=self.visitor,
        )
        CaseService.create_case(self.visitor, self.expert, title="پرونده تست")

    def test_expert_context_includes_active_visitor_summary(self):
        token = resource_context.set(str(self.visitor.id))
        try:
            context = build_default_profile_context(self.expert)
        finally:
            resource_context.reset(token)

        self.assertIn("### USER PROFILE", context)
        self.assertIn("User Profession: روانشناس", context)
        self.assertIn("### ACTIVE VISITOR PROFILE", context)
        self.assertIn("Active Visitor Name: Visitor User", context)
        self.assertIn("Active Visitor Education Level: کارشناسی", context)

    def test_visitor_context_includes_active_expert_summary(self):
        token = selected_doctor_context.set(str(self.expert.id))
        try:
            context = build_default_profile_context(self.visitor)
        finally:
            selected_doctor_context.reset(token)

        self.assertIn("### USER PROFILE", context)
        self.assertIn("User Birth Date: 1375/01/01", context)
        self.assertIn("### ACTIVE EXPERT PROFILE", context)
        self.assertIn("Active Expert Name: Expert User", context)
        self.assertIn("Active Expert Specialty: CBT", context)

from django.test import TestCase

from capabilities.vania_expert.tools import VaniaExpertToolFactory
from capabilities.vania_visitor.tools import VaniaVisitorToolFactory
from users.models import CustomUser, ExpertProfession, UserRole
from vania_core.models import TreatmentConnection


class CapabilityToolFactoryTests(TestCase):
    def setUp(self):
        self.expert_role = UserRole.objects.create(name="متخصص", slug="expert")
        self.visitor_role = UserRole.objects.create(name="مراجعه‌کننده", slug="visitor")

        self.psychologist = ExpertProfession.objects.create(slug="psychologist", name="روانشناس")
        self.psychiatrist = ExpertProfession.objects.create(slug="psychiatrist", name="روانپزشک")

        self.psychologist_user = CustomUser.objects.create_user(
            phone_number="3000000001",
            role=self.expert_role,
            full_name="Psychologist User",
            expert_profession=self.psychologist,
            is_expert_verified=True,
        )
        self.psychiatrist_user = CustomUser.objects.create_user(
            phone_number="3000000002",
            role=self.expert_role,
            full_name="Psychiatrist User",
            expert_profession=self.psychiatrist,
            is_expert_verified=True,
        )
        self.visitor = CustomUser.objects.create_user(
            phone_number="4000000001",
            role=self.visitor_role,
            full_name="Visitor User",
        )

        TreatmentConnection.objects.create(
            doctor=self.psychologist_user,
            patient=self.visitor,
            status=TreatmentConnection.Status.ACTIVE,
        )
        TreatmentConnection.objects.create(
            doctor=self.psychiatrist_user,
            patient=self.visitor,
            status=TreatmentConnection.Status.ACTIVE,
        )

    def _tool_names(self, tools):
        return [getattr(tool, "name", "") for tool in tools]

    def test_expert_factory_returns_wrapped_tool_names_for_psychologist(self):
        tools = VaniaExpertToolFactory().get_tools(self.psychologist_user, "test-session")
        tool_names = self._tool_names(tools)

        self.assertIn("create_case", tool_names)
        self.assertIn("list_accessible_cases", tool_names)
        self.assertIn("get_case_snapshot", tool_names)
        self.assertIn("rename_case", tool_names)
        self.assertIn("update_clinical_summary", tool_names)
        self.assertIn("manage_roadmap", tool_names)
        self.assertNotIn("manage_medications", tool_names)
        self.assertNotIn("list_case_files", tool_names)

    def test_expert_factory_returns_psychiatrist_specific_allowed_tools(self):
        tools = VaniaExpertToolFactory().get_tools(self.psychiatrist_user, "test-session")
        tool_names = self._tool_names(tools)

        self.assertIn("manage_medications", tool_names)
        self.assertIn("manage_roadmap", tool_names)
        self.assertIn("list_accessible_cases", tool_names)
        self.assertIn("get_case_snapshot", tool_names)
        self.assertNotIn("add_rescue_task", tool_names)
        self.assertNotIn("prescribe_resource", tool_names)
        self.assertNotIn("list_case_files", tool_names)

    def test_visitor_factory_handles_wrapped_tool_objects(self):
        tools = VaniaVisitorToolFactory().get_tools(self.visitor, "test-session")
        tool_names = self._tool_names(tools)

        self.assertIn("load_my_journey", tool_names)
        self.assertIn("select_case", tool_names)
        self.assertIn("mark_task_complete", tool_names)
        self.assertNotIn("get_current_medications", tool_names)
        self.assertNotIn("list_case_files", tool_names)

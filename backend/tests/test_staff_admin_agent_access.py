from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from services.access_service import access_service
from services.models import AgentService
from services.views import ServiceListView


class StaffAdminAgentAccessTests(TestCase):
    def setUp(self):
        cache.clear()
        self.staff_user = get_user_model().objects.create_user(
            phone_number="09120000002",
            is_staff=True,
        )
        self.agent = AgentService.objects.create(
            name="Expert Only Agent",
            slug="expert-only-agent",
            description="",
            system_prompt="Test",
            audience=AgentService.Audience.EXPERT,
            eligible_expert_professions=["psychologist"],
            is_free=False,
            is_active=True,
            is_public=False,
        )

    def test_staff_user_can_access_active_agent_without_role_or_plan(self):
        allowed, reason = access_service.check_permission(self.staff_user, self.agent.slug)

        self.assertTrue(allowed)
        self.assertEqual(reason, "Staff/admin access")

    def test_inactive_agent_stays_blocked_for_staff_user(self):
        self.agent.is_active = False
        self.agent.save(update_fields=["is_active", "updated_at"])
        cache.clear()

        allowed, reason = access_service.check_permission(self.staff_user, self.agent.slug)

        self.assertFalse(allowed)
        self.assertEqual(reason, "Service is currently disabled.")

    def test_staff_service_list_includes_private_ineligible_agents_as_owned(self):
        request = APIRequestFactory().get("/api/services/")
        force_authenticate(request, user=self.staff_user)

        response = ServiceListView.as_view()(request)

        slugs = {item["slug"]: item for item in response.data}
        self.assertIn(self.agent.slug, slugs)
        self.assertTrue(slugs[self.agent.slug]["is_owned"])
        self.assertEqual(slugs[self.agent.slug]["access_status"], "OWNED")

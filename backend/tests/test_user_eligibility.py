from types import SimpleNamespace

from django.test import TestCase

from users.eligibility import is_user_eligible_for_agent, is_user_eligible_for_plan


class UserEligibilityTests(TestCase):
    def _user(self, role_slug: str, *, verified: bool = False, profession_slug: str | None = None):
        return SimpleNamespace(
            role=SimpleNamespace(slug=role_slug),
            is_expert_verified=verified,
            expert_profession=SimpleNamespace(slug=profession_slug) if profession_slug else None,
            is_staff=False,
            is_superuser=False,
        )

    def _agent(self, audience: str, *, professions: list[str] | None = None):
        return SimpleNamespace(
            audience=audience,
            eligible_expert_professions=professions or [],
        )

    def _plan(self, audience: str, *, professions: list[str] | None = None):
        return SimpleNamespace(
            audience=audience,
            eligible_expert_professions=professions or [],
        )

    def test_expert_user_is_eligible_for_visitor_audience_agent(self):
        user = self._user("expert", verified=True, profession_slug="psychologist")
        agent = self._agent("VISITOR")
        self.assertTrue(is_user_eligible_for_agent(user, agent))

    def test_expert_user_is_not_eligible_for_visitor_audience_plan(self):
        user = self._user("expert", verified=True, profession_slug="psychologist")
        plan = self._plan("VISITOR")
        self.assertFalse(is_user_eligible_for_plan(user, plan))

    def test_verified_expert_user_is_eligible_for_matching_expert_plan(self):
        user = self._user("expert", verified=True, profession_slug="psychologist")
        plan = self._plan("EXPERT", professions=["psychologist"])
        self.assertTrue(is_user_eligible_for_plan(user, plan))

    def test_staff_user_is_eligible_for_any_agent_audience(self):
        user = self._user("visitor")
        user.is_staff = True
        agent = self._agent("EXPERT", professions=["psychologist"])
        self.assertTrue(is_user_eligible_for_agent(user, agent))

    def test_staff_user_is_eligible_for_any_plan_audience(self):
        user = self._user("visitor")
        user.is_staff = True
        plan = self._plan("EXPERT", professions=["psychologist"])
        self.assertTrue(is_user_eligible_for_plan(user, plan))

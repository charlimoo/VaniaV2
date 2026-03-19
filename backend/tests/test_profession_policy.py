from django.test import TestCase

from capabilities.vania_expert.forms import ALL_FORMS_LIST
from users.expert_validation import validate_profession_credential
from users.models import ExpertProfession
from vania_core.profession_policy import (
    build_canvas_policy_payload,
    filter_form_definitions,
    get_profession_policy,
)


class ProfessionPolicyTests(TestCase):
    def setUp(self):
        self.general_doctor = ExpertProfession.objects.create(
            slug="general_doctor",
            name="پزشک عمومی",
            validation_kind="mock_general_doctor",
            validation_config={"accepted_codes": ["123456"]},
            is_active=True,
        )

    def test_general_doctor_policy_is_exams_only_and_case_forms_disabled(self):
        policy = get_profession_policy("general_doctor")
        self.assertEqual(policy["test_mode"], "exams_only")
        self.assertEqual(policy["expert_tabs"], ["CASE_OVERVIEW", "FILES"])
        self.assertEqual(policy["expert_case_overview_sections"], ["clinical_summary", "tests"])

        payload = build_canvas_policy_payload("general_doctor", viewer="expert", form_definitions=ALL_FORMS_LIST)
        self.assertEqual(payload["allowed_form_keys"], ["BASE_PROFILE_V1"])

    def test_psychologist_does_not_receive_psychiatry_form(self):
        forms = filter_form_definitions(ALL_FORMS_LIST, "psychologist")
        form_keys = {item["key"] for item in forms}
        self.assertIn("BASE_PROFILE_V1", form_keys)
        self.assertNotIn("PSYCHIATRY_V1", form_keys)

    def test_lawyer_policy_is_restrictive(self):
        payload = build_canvas_policy_payload("lawyer", viewer="expert", form_definitions=ALL_FORMS_LIST)
        self.assertEqual(payload["visible_tabs"], ["CASE_OVERVIEW", "FILES"])
        self.assertEqual(payload["case_overview_sections"], ["clinical_summary"])
        self.assertEqual(payload["test_mode"], "disabled")
        self.assertEqual(payload["allowed_form_keys"], ["BASE_PROFILE_V1"])

    def test_general_doctor_validation_accepts_temp_code(self):
        result = validate_profession_credential(
            profession=self.general_doctor,
            full_name="پزشک نمونه",
            credential_code="123456",
        )
        self.assertTrue(result.verified)

        bad_result = validate_profession_credential(
            profession=self.general_doctor,
            full_name="پزشک نمونه",
            credential_code="999999",
        )
        self.assertFalse(bad_result.verified)

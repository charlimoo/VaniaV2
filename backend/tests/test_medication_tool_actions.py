from django.test import SimpleTestCase

from capabilities.vania_expert.tools import _normalize_medication_action, _normalize_medication_payload


class MedicationToolActionNormalizationTests(SimpleTestCase):
    def test_preserves_canonical_actions(self):
        self.assertEqual(_normalize_medication_action("ADD"), "ADD")
        self.assertEqual(_normalize_medication_action("snapshot"), "SNAPSHOT")

    def test_maps_model_style_aliases(self):
        self.assertEqual(_normalize_medication_action("ADD_MEDICATION"), "ADD")
        self.assertEqual(_normalize_medication_action("update_medication"), "UPDATE")
        self.assertEqual(_normalize_medication_action("DELETE_MEDICATION"), "DELETE")
        self.assertEqual(_normalize_medication_action("replace_plan"), "REPLACE")
        self.assertEqual(_normalize_medication_action("LIST_MEDICATIONS"), "SNAPSHOT")

    def test_normalizes_common_extra_medication_fields(self):
        normalized = _normalize_medication_payload(
            {
                "drug_name": "داروی نمونه",
                "dosage": "1 قرص",
                "frequency": "روزی یک بار",
                "route": "خوراکی",
                "start_date": "2026-03-22",
                "instructions": "بعد از غذا",
                "indication": "ثبت آزمایشی",
                "side_effects": "خواب آلودگی",
                "status": "active",
            }
        )

        self.assertEqual(normalized["drug_name"], "داروی نمونه")
        self.assertEqual(normalized["dosage"], "1 قرص")
        self.assertEqual(normalized["timing"], "روزی یک بار")
        self.assertEqual(normalized["duration"], "شروع از 2026-03-22")
        self.assertIn("بعد از غذا", normalized["usage_instructions"])
        self.assertIn("روش مصرف: خوراکی", normalized["usage_instructions"])
        self.assertIn("اندیکاسیون: ثبت آزمایشی", normalized["notes"])
        self.assertIn("عوارض/هشدار: خواب آلودگی", normalized["notes"])
        self.assertIn("وضعیت: active", normalized["notes"])

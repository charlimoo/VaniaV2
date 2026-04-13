from django.test import TestCase

from canvas.routes import _needs_base_profile_rehydration


class CanvasBaseProfileSyncTests(TestCase):
    def test_detects_stale_base_profile_for_patient_journey(self):
        canvases_data = [
            {
                "component_key": "VANIA_PATIENT_JOURNEY",
                "current_state": {
                    "base_profile": {
                        "form": {"full_name": "Old Name"}
                    }
                },
            }
        ]
        canonical = {"full_name": "New Name"}
        self.assertTrue(_needs_base_profile_rehydration(canvases_data, canonical))

    def test_detects_stale_base_profile_for_patient_manager(self):
        canvases_data = [
            {
                "component_key": "VANIA_PATIENT_MANAGER",
                "current_state": {
                    "base_profile": {
                        "form": {"birth_date": "1370/01/01"}
                    }
                },
            }
        ]
        canonical = {"birth_date": "1371/01/01"}
        self.assertTrue(_needs_base_profile_rehydration(canvases_data, canonical))

    def test_no_rehydration_when_canonical_matches_canvas_forms(self):
        canvases_data = [
            {
                "component_key": "VANIA_PATIENT_MANAGER",
                "current_state": {"base_profile": {"form": {"full_name": "Alice"}}},
            },
            {
                "component_key": "VANIA_PATIENT_JOURNEY",
                "current_state": {"base_profile": {"form": {"full_name": "Alice"}}},
            },
        ]
        canonical = {"full_name": "Alice"}
        self.assertFalse(_needs_base_profile_rehydration(canvases_data, canonical))

# backend/capabilities/vania_patient/canvas.py
from typing import Dict, Any
from capabilities.base import BaseCanvas
from capabilities.registry import register_canvas

@register_canvas
class PatientJourneyCanvas(BaseCanvas):
    """
    The visitor's personal dashboard.
    Aggregates tasks and session history from all connected experts
    into a single unified view.
    """
    component_key = "VANIA_PATIENT_JOURNEY"
    name = "مسیر سلامت من" # My Health Journey
    slug = "vania-patient-journey-v1"
    description = "A personal dashboard for visitors to track tasks, session history, and expert connections."

    @classmethod
    def get_default_state(cls) -> Dict[str, Any]:
        return {
            "is_active": True,
            "active_view": "CASES",
            "active_tab": "CASE_OVERVIEW",
            "base_profile": {
                "form": {},
                "forms": [],
                "tests": [],
            },
            "cases": [],
            "selected_case_id": None,
            "selected_case": None,
            "my_doctors": [],
            "selected_doctor_id": None,
        }

    @classmethod
    def get_schema(cls) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "active_view": {"type": "string"},
                "active_tab": {"type": "string"},
                "selected_case_id": {"type": ["string", "null"]},
                "my_doctors": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "name": {"type": "string"}
                        }
                    }
                }
            }
        }

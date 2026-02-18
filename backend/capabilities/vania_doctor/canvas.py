# backend/capabilities/vania_doctor/canvas.py
from typing import Dict, Any
from capabilities.base import BaseCanvas
from capabilities.registry import register_canvas

@register_canvas
class PatientManagerCanvas(BaseCanvas):
    """
    The main clinical dashboard for Doctors.
    It displays the currently selected patient's profile, session history,
    active tasks, and filled forms.
    """
    component_key = "VANIA_PATIENT_MANAGER"
    name = "مدیریت بیمار"
    slug = "vania-patient-manager-v1"
    description = "A comprehensive dashboard for managing a specific patient's clinical data."

    @classmethod
    def get_default_state(cls) -> Dict[str, Any]:
        return {
            # UI Control
            "is_active": False,        # True only when a patient is selected in chat
            "active_tab": "OVERVIEW",  # Options: OVERVIEW, HISTORY, FORMS, TASKS
            
            # Patient Identity
            "patient_profile": None,   # { id, name, phone, age, avatar_url }
            
            # Clinical Data
            "sessions": [],            # List of session log objects
            "tasks": [],               # List of active homework/tasks
            "forms": [],               # List of filled forms meta-data
            "tests": [],               # List of prescribed psychology tests
            "tests_catalog": [],       # Static catalog used to prescribe tests
            "forms_tests_analysis": "",
            
            # UX Hints
            "last_update": None,       # Timestamp of last sync
            "notification": None       # Ephemeral messages (e.g. "Task Added")
        }

    @classmethod
    def get_schema(cls) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "active_tab": {
                    "type": "string", 
                    "enum": ["OVERVIEW", "HISTORY", "FORMS", "TASKS"]
                },
                "is_active": {"type": "boolean"},
                "patient_profile": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "integer"},
                        "name": {"type": "string"},
                        "phone": {"type": "string"}
                    }
                }
            }
        }

# backend/capabilities/vania_patient/canvas.py
from typing import Dict, Any
from capabilities.base import BaseCanvas
from capabilities.registry import register_canvas

@register_canvas
class PatientJourneyCanvas(BaseCanvas):
    """
    The patient's personal dashboard ("Hamrah").
    Aggregates tasks (Homework) and session history from ALL connected doctors 
    into a single unified view.
    """
    component_key = "VANIA_PATIENT_JOURNEY"
    name = "مسیر سلامت من" # My Health Journey
    slug = "vania-patient-journey-v1"
    description = "A personal dashboard for patients to track tasks, session history, and doctor connections."

    @classmethod
    def get_default_state(cls) -> Dict[str, Any]:
        return {
            # UI Header
            "greeting": "خوش آمدید",
            
            # Tasks from all doctors
            # Structure: [{id, text, status, doctor_name, due_date, created_at}]
            "todo_list": [],
            
            # Session logs (Sanitized - Public summary only)
            # Structure: [{date, summary, doctor_name, mood_rating}]
            "timeline_events": [],
            
            # Active connections
            # Structure: [{id, name, specialty, avatar}]
            "my_doctors": []
        }

    @classmethod
    def get_schema(cls) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "greeting": {"type": "string"},
                "todo_list": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "text": {"type": "string"},
                            "status": {"type": "string"}
                        }
                    }
                },
                "timeline_events": {"type": "array"}
            }
        }
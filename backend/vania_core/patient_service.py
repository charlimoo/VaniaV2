# backend/vania_core/patient_service.py
import logging
import json # [FIX] Added import
from asgiref.sync import sync_to_async
from users.models import UserContextEntry
from users.services import user_context_manager
from .services import RoadmapService, TaskService, AppendixService, SessionService, ProfileService

logger = logging.getLogger(__name__)

class PatientDataService:
    """
    Aggregates and Sanitizes VCOS data for the Patient Interface.
    """

    @staticmethod
    def get_patient_dashboard_snapshot(patient) -> dict:
        """
        Returns the full state object for the 'VANIA_PATIENT_JOURNEY' canvas.
        """
        # 1. Fetch Basic Data (Tasks & Appendix)
        tasks = TaskService.get_patient_tasks(patient)
        appendix = AppendixService.get_library(patient)
        
        # 2. Fetch Roadmap & Process Timeline
        roadmap = RoadmapService.get_or_create_roadmap(patient)
        sanitized_timeline = []
        active_smart_goals = []

        for session in roadmap.sessions:
            if session.status == "COMPLETED" and session.doc_id:
                try:
                    # Retrieve the full report entry by ID
                    log_entry = UserContextEntry.objects.filter(pk=session.doc_id).first()
                    
                    if log_entry and isinstance(log_entry.data, dict):
                        doc = log_entry.data
                        
                        # [FIX] Logic to Unpack Structured Report from JSON String
                        # The Agent stores the full JSON report inside the 'summary' text field.
                        raw_summary = doc.get("summary", "")
                        
                        # Default values (fallback)
                        display_summary = raw_summary
                        display_flashcards = doc.get("flashcards", [])
                        
                        # Detect and Parse JSON
                        if isinstance(raw_summary, str) and raw_summary.strip().startswith("{"):
                            try:
                                parsed = json.loads(raw_summary)
                                # If it's our structured report, extract the readable parts
                                if isinstance(parsed, dict) and parsed.get("is_structured_report"):
                                    display_summary = parsed.get("symptoms_analysis") or parsed.get("summary", "")
                                    display_flashcards = parsed.get("flashcards", [])
                                    
                                    # Also update goals from this latest session
                                    if parsed.get("smart_goals"):
                                        active_smart_goals = parsed.get("smart_goals")
                            except (json.JSONDecodeError, TypeError):
                                # If parsing fails, it's just plain text
                                pass

                        timeline_item = {
                            "session_number": session.session_number,
                            "title": session.title,
                            "date": doc.get("date"),
                            "summary": display_summary, # Now contains clean text
                            "flashcards": display_flashcards, 
                            "doc_id": str(session.doc_id)
                        }
                        sanitized_timeline.append(timeline_item)

                except Exception as e:
                    logger.warning(f"Error fetching session log {session.doc_id} for patient {patient.id}: {e}")

        # Reverse timeline so the newest session is first
        sanitized_timeline.reverse()

        # Serialize Pydantic objects
        library_serialized = [res.model_dump() for res in appendix.resources]

        # 3. Assemble Final Payload
        return {
            "greeting": f"سلام {patient.full_name or 'دوست من'}",
            "current_phase": roadmap.current_phase,
            "tasks": tasks,
            "timeline": sanitized_timeline,
            "library": library_serialized,
            "active_goals": active_smart_goals,
            "forms_tests_analysis": ProfileService.get_forms_tests_analysis(patient),
            "my_doctors": []
        }

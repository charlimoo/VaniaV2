# backend/vania_core/patient_service.py
import logging
from asgiref.sync import sync_to_async
from users.models import UserContextEntry
from users.services import user_context_manager
from .services import RoadmapService, TaskService, AppendixService, SessionService

logger = logging.getLogger(__name__)

class PatientDataService:
    """
    Aggregates and Sanitizes VCOS data for the Patient Interface.
    
    This service acts as a 'View Controller' for the patient side. It fetches
    data from the Roadmap, Tasks, and Session logs, but strictly ensures that
    private doctor notes and draft protocols are NEVER exposed to the patient.
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
        # We need to iterate through the roadmap sessions to find completed ones,
        # then fetch the corresponding detailed report (UserContextEntry) to get
        # the public summary and flashcards.
        roadmap = RoadmapService.get_or_create_roadmap(patient)
        sanitized_timeline = []
        active_smart_goals = []

        for session in roadmap.sessions:
            # Only show COMPLETED sessions to the patient
            if session.status == "COMPLETED" and session.doc_id:
                try:
                    # Retrieve the full report entry by ID
                    # We use the generic manager to find the entry
                    log_entry = user_context_manager.get_entry_by_id(session.doc_id)
                    
                    if log_entry and isinstance(log_entry.data, dict):
                        doc = log_entry.data
                        
                        # [SANITIZATION] Extract ONLY public fields
                        # Explicitly exclude 'private_notes', 'doctor_instructions'
                        timeline_item = {
                            "session_number": session.session_number,
                            "title": session.title,
                            "date": doc.get("date"),
                            "summary": doc.get("symptoms_analysis") or doc.get("summary", ""),
                            # Flashcards are the primary educational output for the patient
                            "flashcards": doc.get("flashcards", []), 
                            "doc_id": str(session.doc_id)
                        }
                        sanitized_timeline.append(timeline_item)
                        
                        # Update active goals (take from the latest session)
                        if doc.get("smart_goals"):
                            active_smart_goals = doc.get("smart_goals")

                except Exception as e:
                    logger.warning(f"Error fetching session log {session.doc_id} for patient {patient.id}: {e}")

        # Reverse timeline so the newest session is first
        sanitized_timeline.reverse()

        # 3. Assemble Final Payload
        return {
            "greeting": f"سلام {patient.full_name or 'دوست من'}",
            "current_phase": roadmap.current_phase,
            "tasks": tasks,
            "timeline": sanitized_timeline,
            "library": appendix.resources,
            "active_goals": active_smart_goals,
            
            # Helper for UI to link back to the doctors
            "my_doctors": [] # Populated by capability if needed, or kept empty
        }
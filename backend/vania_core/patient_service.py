# backend/vania_core/patient_service.py
import logging
import json # [FIX] Added import
from asgiref.sync import sync_to_async
from users.models import UserContextEntry
from users.services import user_context_manager
from .services import RoadmapService, TaskService, AppendixService, SessionService, ProfileService
from .tests_service import ClinicalTestsService
from .models import TreatmentConnection
from .flashcards import normalize_flashcards

logger = logging.getLogger(__name__)

class PatientDataService:
    """
    Aggregates and Sanitizes VCOS data for the Patient Interface.
    """

    @staticmethod
    def get_patient_dashboard_snapshot(patient, doctor_id=None) -> dict:
        """
        Returns the full state object for the 'VANIA_PATIENT_JOURNEY' canvas.
        """
        logger.info(
            f"🧪 [PatientDataService] snapshot patient={patient.id} doctor_id={doctor_id}"
        )
        # 1. Fetch Basic Data (Tasks & Appendix)
        tasks = TaskService.get_patient_tasks(patient, doctor_id=doctor_id)
        appendix = AppendixService.get_library(patient, doctor_id=doctor_id)
        
        # 2. Fetch Roadmap & Process Timeline
        roadmap = RoadmapService.get_or_create_roadmap(patient, doctor_id=doctor_id)
        sanitized_timeline = []
        active_smart_goals = []

        for session in roadmap.sessions:
            if session.status == "COMPLETED" and session.doc_id:
                try:
                    # Retrieve the full report entry by ID
                    log_entry = UserContextEntry.objects.filter(pk=session.doc_id).first()
                    
                    if log_entry and isinstance(log_entry.data, dict):
                        doc = log_entry.data
                        if doctor_id and int(doc.get("doctor_id") or 0) != int(doctor_id):
                            continue
                        
                        # [FIX] Logic to Unpack Structured Report from JSON String
                        # The Agent stores the full JSON report inside the 'summary' text field.
                        raw_summary = doc.get("summary", "")
                        
                        # Default values (fallback)
                        display_summary = raw_summary
                        display_flashcards = normalize_flashcards(doc.get("flashcards", []))
                        
                        # Detect and Parse JSON
                        if isinstance(raw_summary, str) and raw_summary.strip().startswith("{"):
                            try:
                                parsed = json.loads(raw_summary)
                                # If it's our structured report, extract the readable parts
                                if isinstance(parsed, dict) and parsed.get("is_structured_report"):
                                    display_summary = parsed.get("symptoms_analysis") or parsed.get("summary", "")
                                    display_flashcards = normalize_flashcards(parsed.get("flashcards", []))
                                    
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
        my_doctors = list(
            TreatmentConnection.objects.filter(
                patient=patient,
                status=TreatmentConnection.Status.ACTIVE
            )
            .select_related("doctor")
            .values("doctor_id", "doctor__full_name", "doctor__phone_number")
        )
        tests = ClinicalTestsService.get_tests(patient, doctor_id=doctor_id)
        logger.info(
            "🧪 [PatientDataService] snapshot result "
            f"selected_doctor_id={doctor_id} tasks={len(tasks)} "
            f"timeline={len(sanitized_timeline)} tests={len(tests)} "
            f"my_doctors={len(my_doctors)}"
        )

        # 3. Assemble Final Payload
        return {
            "greeting": f"سلام {patient.full_name or 'دوست من'}",
            "current_phase": roadmap.current_phase,
            "tasks": tasks,
            "timeline": sanitized_timeline,
            "library": library_serialized,
            "tests": tests,
            "active_goals": active_smart_goals,
            "forms_tests_analysis": ProfileService.get_forms_tests_analysis(patient, doctor_id=doctor_id),
            "my_doctors": [
                {
                    "id": d["doctor_id"],
                    "name": d["doctor__full_name"] or d["doctor__phone_number"],
                }
                for d in my_doctors
            ],
            "selected_doctor_id": int(doctor_id) if doctor_id else None,
        }

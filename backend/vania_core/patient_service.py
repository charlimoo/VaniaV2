import logging
import json
from typing import Optional

from .case_service import CaseService
from .services import RoadmapService, AppendixService, SessionService, TaskService, ProfileService
from .case_files_service import CaseFilesService
from .medication_service import MedicationService

logger = logging.getLogger(__name__)


class PatientDataService:
    """
    Aggregates and sanitizes Vania data for the visitor interface.
    """

    @staticmethod
    def get_patient_dashboard_snapshot(patient, doctor_id: Optional[int] = None, case_id: Optional[str] = None) -> dict:
        cases = CaseService.get_accessible_cases_for_patient(patient)
        selected_case = None
        if case_id:
            selected_case = next((item for item in cases if item.get("id") == case_id), None)
        if not selected_case and doctor_id:
            selected_case = next((item for item in cases if int(item.get("doctor_id") or 0) == int(doctor_id)), None)
        if not selected_case and cases:
            selected_case = cases[0]

        if selected_case:
            doctor_id = int(selected_case["doctor_id"])
            case_id = selected_case["id"]
            roadmap = RoadmapService.get_or_create_roadmap(patient, doctor_id=doctor_id, case_id=case_id)
            appendix = AppendixService.get_library(patient, doctor_id=doctor_id, case_id=case_id)
            medications = MedicationService.get_plan(patient, doctor_id=doctor_id, case_id=case_id)
            tasks = TaskService.get_patient_tasks(patient, doctor_id=doctor_id, case_id=case_id)
            timeline = SessionService.get_patient_history(patient, viewer_role="PATIENT", doctor_id=doctor_id, case_id=case_id)
            tests = CaseService.get_visible_tests(patient, viewer_role="VISITOR", case_id=case_id)
            forms = CaseService.get_visible_form_entries(patient, viewer_role="VISITOR", case_id=case_id)
            clinical_summary = ProfileService.get_summary(patient, doctor_id=doctor_id, case_id=case_id)
            forms_tests_analysis = ProfileService.get_forms_tests_analysis(patient, doctor_id=doctor_id, case_id=case_id)
            current_phase = roadmap.current_phase
            active_goals = PatientDataService._extract_active_goals_from_history(timeline)
            library = [res.model_dump() for res in appendix.resources]
            medication_items = [item.model_dump() for item in medications.medications]
            files = CaseFilesService.get_files(patient, doctor_id=doctor_id, case_id=case_id)
        else:
            tasks = []
            timeline = []
            library = []
            medication_items = []
            tests = []
            forms = []
            files = []
            clinical_summary = ""
            forms_tests_analysis = ""
            current_phase = ""
            active_goals = []

        return {
            "greeting": f"سلام {patient.full_name or 'دوست من'}",
            "current_phase": current_phase,
            "tasks": tasks,
            "timeline": timeline,
            "library": library,
            "medications": medication_items,
            "tests": tests,
            "forms": forms,
            "active_goals": active_goals,
            "clinical_summary": clinical_summary,
            "forms_tests_analysis": forms_tests_analysis,
            "my_doctors": [
                {
                    "id": item["doctor_id"],
                    "name": item.get("doctor_name", ""),
                    "role_label": item.get("doctor_role_label"),
                    "profession_label": item.get("doctor_profession_label"),
                }
                for item in cases
            ],
            "base_profile": {
                "form": CaseService.get_latest_base_profile_entry(patient).data if CaseService.get_latest_base_profile_entry(patient) else {},
                "forms": CaseService.get_visible_form_entries(patient, viewer_role="VISITOR"),
                "tests": CaseService.get_visible_tests(patient, viewer_role="VISITOR"),
            },
            "cases": cases,
            "selected_case_id": selected_case.get("id") if selected_case else None,
            "selected_doctor_id": selected_case.get("doctor_id") if selected_case else doctor_id,
            "selected_case": {
                **(selected_case or {}),
                "tasks": tasks,
                "timeline": timeline,
                "library": library,
                "medications": medication_items,
                "tests": tests,
                "forms": forms,
                "files": files,
                "active_goals": active_goals,
                "clinical_summary": clinical_summary,
                "forms_tests_analysis": forms_tests_analysis,
                "current_phase": current_phase,
            },
        }

    @staticmethod
    def _extract_active_goals_from_history(history) -> list[str]:
        for item in history or []:
            goals = item.get("smart_goals")
            if isinstance(goals, list) and goals:
                return [str(goal).strip() for goal in goals if str(goal).strip()]
            raw_summary = item.get("summary", "")
            if isinstance(raw_summary, str) and raw_summary.strip().startswith("{"):
                try:
                    parsed = json.loads(raw_summary)
                    goals = parsed.get("smart_goals") if isinstance(parsed, dict) else None
                    if goals:
                        return goals
                except Exception:
                    continue
        return []

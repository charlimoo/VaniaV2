import logging
from typing import Any, Dict, List, Optional

from capabilities.base import BaseCapability
from capabilities.registry import register_capability
from agents.context import selected_case_context, selected_doctor_context
from users.models import CustomUser
from vania_core.case_service import CaseService
from vania_core.case_files_service import CaseFilesService
from vania_core.medication_service import MedicationService
from vania_core.profile_snapshots import get_expert_profile_payload, get_visitor_base_profile_payload
from vania_core.profession_policy import (
    build_canvas_policy_payload,
    filter_form_definitions,
    sanitize_visitor_case_payload,
)
from vania_core.services import RoadmapService, AppendixService, SessionService, TaskService, ProfileService
from capabilities.vania_expert.forms import ALL_FORMS_LIST

logger = logging.getLogger(__name__)


@register_capability("vania_visitor")
class VaniaVisitorCapability(BaseCapability):
    @staticmethod
    def _resolve_selected_doctor_id(patient: Any) -> Optional[int]:
        raw = selected_doctor_context.get()
        if raw:
            try:
                return int(raw)
            except (TypeError, ValueError):
                pass
        return None

    def _resolve_selected_case(self, patient: CustomUser) -> Optional[Dict[str, Any]]:
        selected_case_id = selected_case_context.get()
        all_cases = CaseService.get_accessible_cases_for_patient(patient)
        if selected_case_id:
            for case_item in all_cases:
                if case_item.get("id") == selected_case_id:
                    return case_item
        return None

    def _build_case_payload(self, patient: CustomUser, case_item: Dict[str, Any]) -> Dict[str, Any]:
        doctor_id = int(case_item["doctor_id"])
        case_id = case_item["id"]
        roadmap = RoadmapService.get_or_create_roadmap(patient, doctor_id=doctor_id, case_id=case_id)
        appendix = AppendixService.get_library(patient, doctor_id=doctor_id, case_id=case_id)
        medications = MedicationService.get_plan(patient, doctor_id=doctor_id, case_id=case_id)
        return {
            "greeting": f"سلام {patient.full_name or 'دوست من'}",
            "clinical_summary": ProfileService.get_summary(patient, doctor_id=doctor_id, case_id=case_id),
            "current_phase": roadmap.current_phase,
            "tasks": TaskService.get_patient_tasks(patient, doctor_id=doctor_id, case_id=case_id),
            "timeline": SessionService.get_patient_history(patient, viewer_role="PATIENT", doctor_id=doctor_id, case_id=case_id),
            "library": [res.model_dump() for res in appendix.resources],
            "medications": [item.model_dump() for item in medications.medications],
            "tests": CaseService.get_visible_tests(patient, viewer_role="VISITOR", case_id=case_id),
            "forms": CaseService.get_visible_form_entries(patient, viewer_role="VISITOR", case_id=case_id),
            "files": CaseFilesService.get_files(patient, doctor_id=doctor_id, case_id=case_id),
            "forms_tests_analysis": ProfileService.get_forms_tests_analysis(patient, doctor_id=doctor_id, case_id=case_id),
        }

    def get_tools(self, user: Any, session_id: str) -> List:
        from .tools import VaniaVisitorToolFactory
        return VaniaVisitorToolFactory().get_tools(user, session_id)

    def get_system_prompt_additions(self, user: Any) -> str:
        return """
### VANIA VISITOR CAPABILITY: SHARED BASE PROFILE + CASE CONTRACT
- The patient has one shared base profile and multiple cases.
- Base profile is shared with all linked experts.
- Tasks, resources, reflections, non-base forms, and tests belong to the selected case.
- Medications shown in the selected case are read-only for you and come from the expert's prescription plan.
- If you need to act on case data, use the selected case rather than assuming a single expert-global workspace.
- Test results can contain written notes plus attached PDF/image files.
- When you need to inspect the actual contents of a saved test result, use `get_my_test_result_details`.
- Use `get_my_visitor_profile` for your full shared profile and `get_active_expert_profile` when you need the detailed profile of the currently selected expert.
- Case files are shared within the selected case between you and the expert.
- Use `list_case_files` or `search_case_files` before `read_case_file`.
- Read only the minimum relevant excerpt from a file and avoid reproducing whole documents.
"""

    def get_context_prompt(self, user: Any, resource_id: str) -> str:
        try:
            visitor_profile = get_visitor_base_profile_payload(user)
            selected_case = self._resolve_selected_case(user)
            active_expert = get_expert_profile_payload(CustomUser.objects.get(pk=selected_case["doctor_id"])) if selected_case and selected_case.get("doctor_id") else None

            visitor_lines = [
                f"- Name: {visitor_profile.get('full_name', user.phone_number)}",
                f"- Phone: {visitor_profile.get('phone_number', user.phone_number)}",
                f"- Birth date: {visitor_profile.get('birth_date', 'N/A')}",
                f"- Education: {visitor_profile.get('education_level', 'N/A')}",
                f"- Job: {visitor_profile.get('job_status', 'N/A')} {visitor_profile.get('job_title', '')}".strip(),
                f"- Marital status: {visitor_profile.get('marital_status', 'N/A')}",
            ]
            expert_lines = []
            if active_expert:
                expert_lines.extend([
                    f"- Expert: {active_expert.get('full_name', '')}",
                    f"- Profession: {active_expert.get('expert_profession_label', 'N/A')}",
                    f"- Specialty: {active_expert.get('specialty', 'N/A')}",
                    f"- Clinic Address: {active_expert.get('clinic_address', 'N/A')}",
                ])

            return f"""
### VISITOR PROFILE
{chr(10).join(visitor_lines)}

### ACTIVE EXPERT
{chr(10).join(expert_lines) if expert_lines else "- No active expert selected."}
"""
        except Exception as exc:
            logger.error("Failed to build visitor context: %s", exc, exc_info=True)
            return ""

    def get_initial_canvas_state(
        self,
        user: Any,
        session_id: str,
        resource_id: str,
        canvas_key: str
    ) -> Optional[Dict[str, Any]]:
        if canvas_key != "VANIA_PATIENT_JOURNEY":
            return None
        patient = user
        try:
            selected_case = self._resolve_selected_case(patient)
            base_entry = CaseService.get_latest_base_profile_entry(patient)
            profession_slug = selected_case.get("doctor_profession_slug") if selected_case else None
            policy_payload = build_canvas_policy_payload(
                profession_slug,
                viewer="visitor",
                form_definitions=ALL_FORMS_LIST,
            )
            selected_payload = self._build_case_payload(patient, selected_case) if selected_case else {
                "greeting": f"سلام {patient.full_name or 'دوست من'}",
                "clinical_summary": "",
                "current_phase": "",
                "tasks": [],
                "timeline": [],
                "library": [],
                "medications": [],
                "tests": [],
                "forms": [],
                "files": [],
                "forms_tests_analysis": "",
            }
            if selected_case:
                selected_payload = sanitize_visitor_case_payload(
                    selected_payload,
                    profession_slug,
                    policy_payload["allowed_form_keys"],
                )
            return {
                "is_active": True,
                "active_view": "CASES" if selected_case else "BASE",
                "active_tab": policy_payload["visible_tabs"][0] if selected_case and policy_payload["visible_tabs"] else "CASE_OVERVIEW",
                "base_profile": {
                    "form": base_entry.data if base_entry else {},
                    "forms": CaseService.get_visible_form_entries(patient, viewer_role="VISITOR"),
                    "tests": CaseService.get_visible_tests(patient, viewer_role="VISITOR"),
                },
                "cases": CaseService.get_accessible_cases_for_patient(patient),
                "selected_case_id": selected_case.get("id") if selected_case else None,
                "selected_case": {
                    **(selected_case or {}),
                    "id": selected_case.get("id") if selected_case else None,
                    "title": selected_case.get("title") if selected_case else "",
                    **policy_payload,
                    **selected_payload,
                },
                "my_doctors": [
                    {
                        "id": case_item["doctor_id"],
                        "name": case_item.get("doctor_name", ""),
                        "role_label": case_item.get("doctor_role_label"),
                        "profession_label": case_item.get("doctor_profession_label"),
                    }
                    for case_item in CaseService.get_accessible_cases_for_patient(patient)
                ],
                "selected_doctor_id": selected_case.get("doctor_id") if selected_case else self._resolve_selected_doctor_id(patient),
                "available_forms": filter_form_definitions(ALL_FORMS_LIST, profession_slug) if selected_case else filter_form_definitions(ALL_FORMS_LIST, None),
                **policy_payload,
                "ui_signal": None,
            }
        except Exception as exc:
            logger.error("Visitor canvas hydration failed: %s", exc, exc_info=True)
            return None

    def get_default_canvases(self) -> List[str]:
        return ["VANIA_PATIENT_JOURNEY"]

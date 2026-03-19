import json
import logging
from typing import Any, Dict, List, Optional

from capabilities.base import BaseCapability
from capabilities.registry import register_capability
from agents.context import selected_case_context
from users.models import CustomUser
from vania_core.case_service import CaseService
from vania_core.case_files_service import CaseFilesService
from vania_core.profession_policy import (
    build_canvas_policy_payload,
    filter_form_definitions,
    filter_tests_catalog,
    get_policy_for_user,
    sanitize_expert_case_payload,
)
from vania_core.services import (
    RoadmapService,
    AppendixService,
    SessionService,
    TaskService,
    ProfileService,
)
from vania_core.medication_service import MedicationService
from vania_core.tests_catalog import TEST_CATALOG

from .forms import ALL_FORMS_LIST

logger = logging.getLogger(__name__)


@register_capability("vania_expert")
class VaniaExpertCapability(BaseCapability):
    def get_tools(self, user: Any, session_id: str) -> List[Any]:
        from .tools import VaniaExpertToolFactory
        return VaniaExpertToolFactory().get_tools(user, session_id)

    def get_system_prompt_additions(self, user: Any) -> str:
        policy = get_policy_for_user(user)
        return f"""
### VANIA EXPERT CAPABILITY: SHARED BASE PROFILE + CASE CONTRACT
You operate on two layers of patient data:

1. Shared base profile
- Shared between the patient and all linked experts.
- `BASE_PROFILE_V1` is the visitor-owned shared profile.
- Base profile read/write actions are not tied to a selected case.

2. Case data (پرونده)
- Every state-changing action for summary, analysis, roadmap, tasks, appendix, sessions, non-base forms, and tests belongs to the active case.
- Medication prescriptions also belong to the active case and are shared with the visitor for reading.
- A patient may have multiple cases with the same expert.
- If no case is selected yet, create/select one before doing case work.

Privacy rules:
- `BASE_PROFILE_V1` is shared.
- Non-base forms and tests are visible only to the patient and the submitting expert.
- Always use tools to keep canvas state synchronized.
- Test results may include free-text notes plus attached PDF/image files.
- When you need the contents of a test result file, use `get_test_result_details` instead of guessing from metadata.
- Use `get_my_expert_profile` for your own detailed profile and `get_active_visitor_profile` for the visitor's full shared profile when the brief context is not enough.
- Case files are shared within the active case between the expert and visitor.
- Use `list_case_files` or `search_case_files` before `read_case_file`.
- Read only the minimum relevant excerpts from files; do not dump entire documents into the conversation.

### PROFESSION-SCOPED ACCESS
{policy.get("prompt_addition", "").strip()}
"""

    def _resolve_selected_case_id(self) -> Optional[str]:
        return selected_case_context.get()

    def _extract_active_goals(self, patient: CustomUser, doctor_id: int, case_id: str) -> List[str]:
        roadmap = RoadmapService.get_or_create_roadmap(patient, doctor_id=doctor_id, case_id=case_id)
        for session in reversed(roadmap.sessions):
            if session.status != "COMPLETED" or not session.doc_id:
                continue
            try:
                from users.models import UserContextEntry

                log_entry = UserContextEntry.objects.filter(pk=session.doc_id).first()
                if not log_entry or not isinstance(log_entry.data, dict):
                    continue
                raw_summary = log_entry.data.get("summary", "")
                parsed = raw_summary if isinstance(raw_summary, dict) else json.loads(raw_summary) if isinstance(raw_summary, str) and raw_summary.strip().startswith("{") else {}
                goals = parsed.get("smart_goals") if isinstance(parsed, dict) else None
                if goals:
                    return goals
            except Exception:
                continue
        return []

    def _build_case_payload(self, patient: CustomUser, doctor_id: int, case_id: str) -> Dict[str, Any]:
        roadmap = RoadmapService.get_or_create_roadmap(patient, doctor_id=doctor_id, case_id=case_id)
        appendix = AppendixService.get_library(patient, doctor_id=doctor_id, case_id=case_id)
        medications = MedicationService.get_plan(patient, doctor_id=doctor_id, case_id=case_id)
        return {
            "clinical_summary": ProfileService.get_summary(patient, doctor_id=doctor_id, case_id=case_id),
            "forms_tests_analysis": ProfileService.get_forms_tests_analysis(patient, doctor_id=doctor_id, case_id=case_id),
            "roadmap_data": roadmap.model_dump(),
            "appendix_data": appendix.model_dump(),
            "medications": [item.model_dump() for item in medications.medications],
            "tasks": TaskService.get_patient_tasks(patient, doctor_id=doctor_id, case_id=case_id),
            "sessions": SessionService.get_patient_history(patient, viewer_role="DOCTOR", doctor_id=doctor_id, case_id=case_id),
            "active_goals": self._extract_active_goals(patient, doctor_id, case_id),
            "forms": CaseService.get_visible_form_entries(patient, viewer_role="EXPERT", viewer_doctor_id=doctor_id, case_id=case_id),
            "tests": CaseService.get_visible_tests(patient, viewer_role="EXPERT", viewer_doctor_id=doctor_id, case_id=case_id),
            "files": CaseFilesService.get_files(patient, doctor_id=doctor_id, case_id=case_id),
        }

    def get_context_prompt(self, user: Any, resource_id: str) -> str:
        if not resource_id:
            return ""
        try:
            patient = CustomUser.objects.get(pk=resource_id)
            selected_case = CaseService.get_or_create_selected_case_for_expert(patient, user, self._resolve_selected_case_id())
            storage_doctor_id = int(selected_case.get("doctor_id") or user.id)
            base_profile = CaseService.get_latest_base_profile_entry(patient)
            base_lines = []
            if base_profile and isinstance(base_profile.data, dict):
                data = base_profile.data
                base_lines.extend([
                    f"- Name: {data.get('full_name', patient.full_name or patient.phone_number)}",
                    f"- Mobile: {data.get('mobile_phone', patient.phone_number)}",
                    f"- Email: {data.get('email', 'N/A')}",
                    f"- Birth date: {data.get('birth_date', 'N/A')}",
                    f"- Education: {data.get('education_level', 'N/A')}",
                    f"- Job: {data.get('job_status', 'N/A')} {data.get('job_title', '')}".strip(),
                    f"- Marital status: {data.get('marital_status', 'N/A')}",
                ])
            case_forms = CaseService.get_visible_form_entries(patient, viewer_role="EXPERT", viewer_doctor_id=storage_doctor_id, case_id=selected_case["id"])
            case_tests = CaseService.get_visible_tests(patient, viewer_role="EXPERT", viewer_doctor_id=storage_doctor_id, case_id=selected_case["id"])
            case_files = CaseFilesService.get_files(patient, doctor_id=storage_doctor_id, case_id=selected_case["id"])
            policy = get_policy_for_user(user)
            allowed_forms = filter_form_definitions(ALL_FORMS_LIST, getattr(getattr(user, "expert_profession", None), "slug", None))
            allowed_tests = filter_tests_catalog(TEST_CATALOG, getattr(getattr(user, "expert_profession", None), "slug", None))
            return f"""
### ACTIVE PATIENT
- Visitor: {patient.full_name or patient.phone_number} (ID: {patient.id})
- Active case: {selected_case['title']} (ID: {selected_case['id']})
- Access mode: {"Owner" if selected_case.get("can_edit") else "Read-only shared case"}

### SHARED BASE PROFILE
{chr(10).join(base_lines) if base_lines else "- No shared base profile recorded yet. Fill `BASE_PROFILE_V1` when needed."}

### CASE CONTEXT
- Case forms visible to you: {len(case_forms)}
- Case tests visible to you: {len(case_tests)}
- Case files visible to you: {len(case_files)}
- Base profile is shared; all other forms/tests are private to the patient and the submitting expert.
- Use file tools for document exploration instead of inferring from filenames.

### AVAILABLE FORMS
{chr(10).join([f"- `{f['key']}` | {f['title']}" for f in allowed_forms]) or "- No case forms available beyond shared base profile."}

### AVAILABLE TESTS
{chr(10).join([f"- `{t['id']}` | {t['title']}" for t in allowed_tests]) or "- No catalog-based tests available for your profession."}

### PROFESSION ACCESS
- Profession policy: {policy.get('profession_slug') or 'unknown'}
- Visible expert tabs: {", ".join(policy.get("expert_tabs", [])) or "none"}
- Test mode: {policy.get("test_mode", "disabled")}
- Restriction note: {policy.get("prompt_addition", "").strip()}
"""
        except Exception as exc:
            logger.error("Failed to build expert context: %s", exc, exc_info=True)
            return "### SYSTEM ERROR: Could not load patient context."

    def get_initial_canvas_state(
        self,
        user: Any,
        session_id: str,
        resource_id: str,
        canvas_key: str,
    ) -> Optional[Dict[str, Any]]:
        if canvas_key != "VANIA_PATIENT_MANAGER" or not resource_id:
            return None
        try:
            patient = CustomUser.objects.get(pk=resource_id)
            selected_case = CaseService.get_or_create_selected_case_for_expert(patient, user, self._resolve_selected_case_id())
            storage_doctor_id = int(selected_case.get("doctor_id") or user.id)
            policy_payload = build_canvas_policy_payload(
                getattr(getattr(user, "expert_profession", None), "slug", None),
                viewer="expert",
                form_definitions=ALL_FORMS_LIST,
            )
            allowed_form_keys = policy_payload["allowed_form_keys"]
            available_forms = filter_form_definitions(ALL_FORMS_LIST, getattr(getattr(user, "expert_profession", None), "slug", None))
            selected_case_payload = sanitize_expert_case_payload(
                self._build_case_payload(patient, storage_doctor_id, selected_case["id"]),
                getattr(getattr(user, "expert_profession", None), "slug", None),
                allowed_form_keys,
            )
            return {
                "is_active": True,
                "active_view": "CASES",
                "active_tab": policy_payload["visible_tabs"][0] if policy_payload["visible_tabs"] else "CASE_OVERVIEW",
                "patient_profile": CaseService.build_patient_profile(patient),
                "base_profile": {
                    "form": CaseService.get_latest_base_profile_entry(patient).data if CaseService.get_latest_base_profile_entry(patient) else {},
                    "forms": sanitize_expert_case_payload(
                        {
                            "forms": CaseService.get_visible_form_entries(patient, viewer_role="EXPERT", viewer_doctor_id=storage_doctor_id),
                            "tests": CaseService.get_visible_tests(patient, viewer_role="EXPERT", viewer_doctor_id=storage_doctor_id),
                        },
                        getattr(getattr(user, "expert_profession", None), "slug", None),
                        allowed_form_keys,
                    )["forms"],
                    "tests": sanitize_expert_case_payload(
                        {
                            "forms": [],
                            "tests": CaseService.get_visible_tests(patient, viewer_role="EXPERT", viewer_doctor_id=storage_doctor_id),
                        },
                        getattr(getattr(user, "expert_profession", None), "slug", None),
                        allowed_form_keys,
                    )["tests"],
                },
                "cases": CaseService.get_accessible_cases_for_expert(patient, user),
                "selected_case_id": selected_case["id"],
                "selected_case": {
                    "id": selected_case["id"],
                    "title": selected_case["title"],
                    "doctor_id": selected_case.get("doctor_id"),
                    "doctor_name": selected_case.get("doctor_name"),
                    "doctor_profession_slug": selected_case.get("doctor_profession_slug"),
                    "doctor_profession_label": selected_case.get("doctor_profession_label"),
                    "can_edit": selected_case.get("can_edit", True),
                    "is_read_only": selected_case.get("is_read_only", False),
                    **policy_payload,
                    **selected_case_payload,
                },
                "tests_catalog": filter_tests_catalog(TEST_CATALOG, getattr(getattr(user, "expert_profession", None), "slug", None)),
                "available_forms": available_forms,
                **policy_payload,
                "ui_signal": None,
            }
        except Exception as exc:
            logger.error("Expert canvas hydration failed: %s", exc, exc_info=True)
            return None

    def get_default_canvases(self) -> List[str]:
        return ["VANIA_PATIENT_MANAGER"]

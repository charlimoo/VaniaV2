import json
import logging
import time
from typing import Any, AsyncGenerator, Dict, List, Optional

from asgiref.sync import sync_to_async
from django.utils import timezone

from agno.run import RunContext
from agno.tools import tool

from agents.context import resource_context, selected_case_context
from capabilities.base import BaseCapability
from capabilities.registry import register_tool
from canvas.events import CanvasUpdateEvent
from services.models_canvas import CanvasInstance
from users.models import ContextDefinition, CustomUser, UserContextEntry
from users.services import user_context_manager
from vania_core.case_service import CaseService
from vania_core.flashcards import normalize_flashcards
from vania_core.medication_service import MedicationService
from vania_core.profession_policy import (
    build_canvas_policy_payload,
    filter_form_definitions,
    filter_tests_catalog,
    get_policy_for_user,
    is_tool_family_allowed,
    resolve_allowed_form_keys,
    sanitize_expert_case_payload,
)
from vania_core.profile_snapshots import get_expert_profile_payload, get_visitor_base_profile_payload
from vania_core.schemas import TherapyPhase
from vania_core.services import AppendixService, ProfileService, RoadmapService, SessionService, TaskService
from vania_core.case_files_service import CaseFilesService
from vania_core.tests_service import ClinicalTestsService
from vania_core.tests_catalog import TEST_CATALOG

from .forms import ALL_FORMS_LIST

logger = logging.getLogger(__name__)

TOOL_FAMILY_BY_NAME = {
    "get_my_expert_profile": "profiles",
    "get_active_visitor_profile": "profiles",
    "create_case": "case_management",
    "rename_case": "case_management",
    "delete_case": "case_management",
    "select_case": "case_management",
    "update_clinical_summary": "clinical_summary",
    "manage_roadmap": "roadmap",
    "finalize_session_report": "roadmap",
    "add_rescue_task": "rescue_net",
    "prescribe_resource": "appendix",
    "manage_medications": "medications",
    "get_current_medications": "medications",
    "get_form_schema": "forms",
    "submit_clinical_form": "forms",
    "manage_clinical_tests": "tests",
    "get_test_result_details": "tests",
    "list_case_files": "files",
    "search_case_files": "files",
    "read_case_file": "files",
    "get_case_file_details": "files",
    "update_forms_tests_analysis": "analysis",
}


def _flatten_form_fields(schema: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    flattened: List[Dict[str, Any]] = []
    for field in schema or []:
        if field.get("type") == "section":
            flattened.extend(_flatten_form_fields(field.get("fields", [])))
            continue
        flattened.append(field)
    return flattened


async def _get_active_patient() -> Optional[CustomUser]:
    patient_id = resource_context.get()
    if not patient_id:
        return None
    try:
        return await CustomUser.objects.aget(pk=patient_id)
    except CustomUser.DoesNotExist:
        return None


async def _get_active_case(patient: CustomUser, doctor: CustomUser) -> Dict[str, Any]:
    requested_case_id = selected_case_context.get()
    return await sync_to_async(CaseService.get_or_create_selected_case_for_expert)(patient, doctor, requested_case_id)


async def _ensure_case_editable(patient: CustomUser, doctor: CustomUser, case_id: str) -> Optional[str]:
    can_edit = await sync_to_async(CaseService.expert_can_edit_case)(patient, doctor, case_id)
    if can_edit:
        return None
    return "❌ This case is read-only for you."


async def _get_canvas_id(session_id: str, component_key: str) -> Optional[str]:
    try:
        instance = await CanvasInstance.objects.filter(
            session_id=session_id,
            canvas_def__component_key=component_key
        ).afirst()
        return str(instance.id) if instance else None
    except Exception as exc:
        logger.error("Failed to resolve canvas id: %s", exc)
        return None


def _extract_active_goals_from_history(history: List[Dict[str, Any]]) -> List[str]:
    for item in history:
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


async def _build_case_payload(patient: CustomUser, doctor_id: int, case_id: str) -> Dict[str, Any]:
    roadmap = await sync_to_async(RoadmapService.get_or_create_roadmap)(patient, doctor_id, case_id)
    appendix = await sync_to_async(AppendixService.get_library)(patient, doctor_id, case_id)
    medications = await sync_to_async(MedicationService.get_plan)(patient, doctor_id, case_id)
    sessions = await sync_to_async(SessionService.get_patient_history)(patient, "DOCTOR", doctor_id, case_id)
    return {
        "selected_case": {
            "clinical_summary": await sync_to_async(ProfileService.get_summary)(patient, doctor_id, case_id),
            "forms_tests_analysis": await sync_to_async(ProfileService.get_forms_tests_analysis)(patient, doctor_id, case_id),
            "roadmap_data": roadmap.model_dump(),
            "appendix_data": appendix.model_dump(),
            "medications": [item.model_dump() for item in medications.medications],
            "tasks": await sync_to_async(TaskService.get_patient_tasks)(patient, doctor_id, case_id),
            "sessions": sessions,
            "active_goals": _extract_active_goals_from_history(sessions),
            "forms": await sync_to_async(CaseService.get_visible_form_entries)(patient, "EXPERT", doctor_id, case_id),
            "tests": await sync_to_async(CaseService.get_visible_tests)(patient, "EXPERT", doctor_id, case_id),
            "files": await sync_to_async(CaseFilesService.get_files)(patient, doctor_id, case_id),
        },
        "base_profile": {
            "form": (await sync_to_async(CaseService.get_latest_base_profile_entry)(patient)).data if await sync_to_async(CaseService.get_latest_base_profile_entry)(patient) else {},
            "forms": await sync_to_async(CaseService.get_visible_form_entries)(patient, "EXPERT", doctor_id, None),
            "tests": await sync_to_async(CaseService.get_visible_tests)(patient, "EXPERT", doctor_id, None),
        }
    }


def _tool_family_error(doctor: CustomUser, family: str) -> Optional[str]:
    policy = get_policy_for_user(doctor)
    if is_tool_family_allowed(policy, family):
        return None
    return "❌ This action is not available for your expert profession."


def _resolve_allowed_form_keys_for_user(doctor: CustomUser) -> List[str]:
    return resolve_allowed_form_keys(ALL_FORMS_LIST, getattr(getattr(doctor, "expert_profession", None), "slug", None))


async def _emit_canvas_refresh(run_context: RunContext, patient: CustomUser, doctor: CustomUser, case_id: str, extra_delta: Optional[Dict[str, Any]] = None):
    canvas_id = await _get_canvas_id(run_context.session_id, "VANIA_PATIENT_MANAGER")
    case_meta = await sync_to_async(CaseService.get_accessible_case_for_expert)(patient, doctor, case_id)
    storage_doctor_id = int((case_meta or {}).get("doctor_id") or doctor.id)
    payload = await _build_case_payload(patient, storage_doctor_id, case_id)
    profession_slug = getattr(getattr(doctor, "expert_profession", None), "slug", None)
    policy_payload = build_canvas_policy_payload(profession_slug, viewer="expert", form_definitions=ALL_FORMS_LIST)
    allowed_form_keys = policy_payload["allowed_form_keys"]
    selected_case_payload = sanitize_expert_case_payload(
        payload["selected_case"],
        profession_slug,
        allowed_form_keys,
    )
    payload.update({
        **policy_payload,
        "selected_case_id": case_id,
        "cases": await sync_to_async(CaseService.get_accessible_cases_for_expert)(patient, doctor),
        "patient_profile": await sync_to_async(CaseService.build_patient_profile)(patient),
        "base_profile": {
            "form": payload["base_profile"]["form"],
            "forms": sanitize_expert_case_payload(
                {
                    "forms": payload["base_profile"]["forms"],
                    "tests": [],
                },
                profession_slug,
                allowed_form_keys,
            )["forms"],
            "tests": sanitize_expert_case_payload(
                {
                    "forms": [],
                    "tests": payload["base_profile"]["tests"],
                },
                profession_slug,
                allowed_form_keys,
            )["tests"],
        },
        "tests_catalog": filter_tests_catalog(TEST_CATALOG, profession_slug),
        "available_forms": filter_form_definitions(ALL_FORMS_LIST, profession_slug),
        "selected_case": {
            "id": case_id,
            "title": case_meta.get("title") if case_meta else "",
            "doctor_id": case_meta.get("doctor_id") if case_meta else storage_doctor_id,
            "doctor_name": case_meta.get("doctor_name") if case_meta else "",
            "doctor_profession_slug": case_meta.get("doctor_profession_slug") if case_meta else profession_slug,
            "doctor_profession_label": case_meta.get("doctor_profession_label") if case_meta else "",
            "can_edit": case_meta.get("can_edit", True) if case_meta else True,
            "is_read_only": case_meta.get("is_read_only", False) if case_meta else False,
            **policy_payload,
            **selected_case_payload,
        },
    })
    if extra_delta:
        payload.update(extra_delta)
    return CanvasUpdateEvent(value={
        "canvas_id": canvas_id,
        "component_key": "VANIA_PATIENT_MANAGER",
        "delta": payload,
    })


@tool
async def get_my_expert_profile(run_context: RunContext) -> AsyncGenerator[Any, None]:
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    payload = await sync_to_async(get_expert_profile_payload)(doctor)
    if not payload:
        yield "❌ Expert profile not found."
        return
    yield json.dumps(payload, ensure_ascii=False, indent=2)


@tool
async def get_active_visitor_profile(run_context: RunContext) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient()
    if not patient:
        yield "Error: No visitor selected."
        return
    payload = await sync_to_async(get_visitor_base_profile_payload)(patient)
    yield json.dumps(payload, ensure_ascii=False, indent=2)


@tool
async def create_case(run_context: RunContext, title: str = "") -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    if not patient:
        yield "Error: No visitor selected."
        return
    created_case = await sync_to_async(CaseService.create_case)(patient, doctor, title or None)
    event = await _emit_canvas_refresh(run_context, patient, doctor, created_case["id"], {"active_view": "CASES"})
    yield event
    yield f"✅ Case '{created_case['title']}' created and selected."


@tool
async def rename_case(run_context: RunContext, case_id: str, title: str) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    if not patient:
        yield "Error: No visitor selected."
        return
    editable_error = await _ensure_case_editable(patient, doctor, case_id)
    if editable_error:
        yield editable_error
        return
    updated_case = await sync_to_async(CaseService.rename_case)(patient, int(doctor.id), case_id, title)
    if not updated_case:
        yield "❌ Case not found or title is invalid."
        return
    event = await _emit_canvas_refresh(run_context, patient, doctor, case_id, {"active_view": "CASES"})
    yield event
    yield f"✅ Case renamed to '{updated_case['title']}'."


@tool
async def delete_case(run_context: RunContext, case_id: str) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    if not patient:
        yield "Error: No visitor selected."
        return
    case_item = await sync_to_async(CaseService.get_accessible_case_for_expert)(patient, doctor, case_id)
    if not case_item:
        yield "❌ Case not found."
        return
    if not case_item.get("can_edit"):
        yield "❌ This case is read-only for you."
        return
    deleted = await sync_to_async(CaseService.delete_case)(patient, int(doctor.id), case_id)
    if not deleted:
        yield "❌ Case could not be deleted."
        return
    remaining_cases = await sync_to_async(CaseService.get_accessible_cases_for_expert)(patient, doctor)
    if remaining_cases:
        next_case_id = remaining_cases[0]["id"]
    else:
        next_case = await sync_to_async(CaseService.create_case)(patient, doctor)
        next_case_id = next_case["id"]
    event = await _emit_canvas_refresh(run_context, patient, doctor, next_case_id, {"active_view": "CASES"})
    yield event
    yield f"✅ Case '{case_item['title']}' deleted."


@tool
async def select_case(run_context: RunContext, case_id: str) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    if not patient:
        yield "Error: No visitor selected."
        return
    case_item = await sync_to_async(CaseService.get_accessible_case_for_expert)(patient, doctor, case_id)
    if not case_item:
        yield "❌ Case not found."
        return
    event = await _emit_canvas_refresh(run_context, patient, doctor, case_id, {"active_view": "CASES"})
    yield event
    yield f"✅ Case '{case_item['title']}' is now active."


@tool
async def update_clinical_summary(run_context: RunContext, summary_text: str) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    blocked = _tool_family_error(doctor, "clinical_summary")
    if blocked:
        yield blocked
        return
    if not patient:
        yield "Error: No visitor is selected."
        return
    active_case = await _get_active_case(patient, doctor)
    editable_error = await _ensure_case_editable(patient, doctor, active_case["id"])
    if editable_error:
        yield editable_error
        return
    await sync_to_async(ProfileService.update_summary)(patient, summary_text, int(active_case.get("doctor_id") or doctor.id), active_case["id"])
    yield await _emit_canvas_refresh(run_context, patient, doctor, active_case["id"])
    yield "✅ Case clinical summary updated."


@tool
async def manage_roadmap(run_context: RunContext, action: str, data: Dict[str, Any] = {}) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    blocked = _tool_family_error(doctor, "roadmap")
    if blocked:
        yield blocked
        return
    if not patient:
        yield "Error: No visitor selected."
        return
    active_case = await _get_active_case(patient, doctor)
    editable_error = await _ensure_case_editable(patient, doctor, active_case["id"])
    if editable_error:
        yield editable_error
        return
    doctor_id = int(active_case.get("doctor_id") or doctor.id)
    action_key = (action or "").upper()
    if action_key == "SET_PHASE":
        phase_enum = TherapyPhase(data.get("phase"))
        await sync_to_async(RoadmapService.update_phase)(patient, phase_enum, doctor_id, active_case["id"])
    elif action_key == "ADD_SESSION":
        await sync_to_async(RoadmapService.add_session)(
            patient,
            data.get("title") or "جلسه جدید",
            data.get("instructions", ""),
            data.get("scheduled_date"),
            doctor_id,
            active_case["id"],
        )
    elif action_key == "UPDATE_STRATEGY":
        roadmap = await sync_to_async(RoadmapService.get_or_create_roadmap)(patient, doctor_id, active_case["id"])
        roadmap.treatment_approaches = data.get("approaches", [])
        await sync_to_async(RoadmapService.save_roadmap)(patient, roadmap, doctor_id, active_case["id"])
    else:
        yield f"❌ Unknown action for manage_roadmap: '{action}'"
        return
    await sync_to_async(CaseService.touch_case)(patient, doctor_id, active_case["id"])
    yield await _emit_canvas_refresh(run_context, patient, doctor, active_case["id"])
    yield "✅ Roadmap updated."


@tool
async def finalize_session_report(
    run_context: RunContext,
    session_number: int,
    topic: str,
    swot: Dict[str, List[str]],
    smart_goals: List[str],
    flashcards: List[Dict[str, str]],
    summary: str,
    private_notes: str = "",
) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    blocked = _tool_family_error(doctor, "roadmap")
    if blocked:
        yield blocked
        return
    if not patient:
        yield "Error: No visitor selected."
        return
    active_case = await _get_active_case(patient, doctor)
    editable_error = await _ensure_case_editable(patient, doctor, active_case["id"])
    if editable_error:
        yield editable_error
        return
    normalized_flashcards = normalize_flashcards(flashcards)
    payload = {
        "is_structured_report": True,
        "session_number": session_number,
        "topic": topic,
        "date": timezone.now().strftime("%Y-%m-%d"),
        "symptoms_analysis": summary,
        "swot_analysis": swot,
        "smart_goals": smart_goals,
        "flashcards": normalized_flashcards,
    }
    log_entry = await sync_to_async(SessionService.log_session)(
        patient, doctor, json.dumps(payload, ensure_ascii=False), private_notes, None, int(active_case.get("doctor_id") or doctor.id), active_case["id"]
    )
    await sync_to_async(RoadmapService.complete_session)(patient, session_number, str(log_entry.id), int(active_case.get("doctor_id") or doctor.id), active_case["id"])
    await sync_to_async(CaseService.touch_case)(patient, int(active_case.get("doctor_id") or doctor.id), active_case["id"])
    yield await _emit_canvas_refresh(run_context, patient, doctor, active_case["id"])
    yield f"✅ Session {session_number} report finalized."


@tool
async def add_rescue_task(run_context: RunContext, text: str, dimension: str, due_date: str = None) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    blocked = _tool_family_error(doctor, "rescue_net")
    if blocked:
        yield blocked
        return
    if not patient:
        yield "Error: No visitor selected."
        return
    active_case = await _get_active_case(patient, doctor)
    editable_error = await _ensure_case_editable(patient, doctor, active_case["id"])
    if editable_error:
        yield editable_error
        return
    storage_doctor_id = int(active_case.get("doctor_id") or doctor.id)
    await sync_to_async(TaskService.assign_task)(patient, doctor, text, due_date, dimension.upper(), storage_doctor_id, active_case["id"])
    await sync_to_async(CaseService.touch_case)(patient, storage_doctor_id, active_case["id"])
    yield await _emit_canvas_refresh(run_context, patient, doctor, active_case["id"])
    yield f"✅ Task added to {dimension}."


@tool
async def prescribe_resource(run_context: RunContext, type: str, title: str, creator: str, reason: str, excerpt: str = "") -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    blocked = _tool_family_error(doctor, "appendix")
    if blocked:
        yield blocked
        return
    if not patient:
        yield "Error: No visitor selected."
        return
    active_case = await _get_active_case(patient, doctor)
    editable_error = await _ensure_case_editable(patient, doctor, active_case["id"])
    if editable_error:
        yield editable_error
        return
    await sync_to_async(AppendixService.add_resource)(
        patient,
        doctor,
        {
            "type": type.upper(),
            "title": title,
            "creator": creator,
            "reason_for_prescription": reason,
            "content_excerpt": excerpt,
        },
        int(active_case.get("doctor_id") or doctor.id),
        active_case["id"],
    )
    await sync_to_async(CaseService.touch_case)(patient, int(active_case.get("doctor_id") or doctor.id), active_case["id"])
    yield await _emit_canvas_refresh(run_context, patient, doctor, active_case["id"])
    yield f"✅ Resource '{title}' added."


@tool
async def manage_medications(run_context: RunContext, action: str, data: Dict[str, Any] = {}) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    blocked = _tool_family_error(doctor, "medications")
    if blocked:
        yield blocked
        return
    if not patient:
        yield "Error: No visitor selected."
        return
    active_case = await _get_active_case(patient, doctor)
    editable_error = await _ensure_case_editable(patient, doctor, active_case["id"])
    if editable_error:
        yield editable_error
        return

    storage_doctor_id = int(active_case.get("doctor_id") or doctor.id)
    action_key = (action or "").upper()
    if action_key == "ADD":
        await sync_to_async(MedicationService.add_medication)(
            patient,
            doctor,
            {
                "drug_name": data.get("drug_name") or data.get("name") or "",
                "dosage": data.get("dosage", ""),
                "usage_instructions": data.get("usage_instructions", ""),
                "timing": data.get("timing", ""),
                "duration": data.get("duration", ""),
                "notes": data.get("notes", ""),
            },
            storage_doctor_id,
            active_case["id"],
        )
    elif action_key == "UPDATE":
        updated = await sync_to_async(MedicationService.update_medication)(
            patient,
            data.get("medication_id") or data.get("id"),
            {
                key: value
                for key, value in {
                    "drug_name": data.get("drug_name", data.get("name")),
                    "dosage": data.get("dosage"),
                    "usage_instructions": data.get("usage_instructions"),
                    "timing": data.get("timing"),
                    "duration": data.get("duration"),
                    "notes": data.get("notes"),
                }.items()
                if value is not None
            },
            creator=doctor,
            doctor_id=storage_doctor_id,
            case_id=active_case["id"],
        )
        if not updated:
            yield "❌ Medication not found."
            return
    elif action_key == "DELETE":
        deleted = await sync_to_async(MedicationService.delete_medication)(
            patient,
            data.get("medication_id") or data.get("id"),
            creator=doctor,
            doctor_id=storage_doctor_id,
            case_id=active_case["id"],
        )
        if not deleted:
            yield "❌ Medication not found."
            return
    elif action_key == "REPLACE":
        plan = await sync_to_async(MedicationService.save_plan)(
            patient,
            data.get("medications", []),
            doctor,
            storage_doctor_id,
            active_case["id"],
        )
        yield json.dumps(plan.model_dump(), ensure_ascii=False, indent=2)
    else:
        yield f"❌ Unknown medication action '{action}'."
        return

    await sync_to_async(CaseService.touch_case)(patient, storage_doctor_id, active_case["id"])
    yield await _emit_canvas_refresh(run_context, patient, doctor, active_case["id"])
    yield "✅ Medication plan updated."


@tool
async def get_current_medications(run_context: RunContext) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    blocked = _tool_family_error(doctor, "medications")
    if blocked:
        yield blocked
        return
    if not patient:
        yield "Error: No visitor selected."
        return
    active_case = await _get_active_case(patient, doctor)
    storage_doctor_id = int(active_case.get("doctor_id") or doctor.id)
    plan = await sync_to_async(MedicationService.get_plan)(patient, storage_doctor_id, active_case["id"])
    yield json.dumps(plan.model_dump(), ensure_ascii=False, indent=2)


@tool
async def get_form_schema(run_context: RunContext, form_key: str) -> AsyncGenerator[Any, None]:
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    blocked = _tool_family_error(doctor, "forms")
    if blocked:
        yield blocked
        return
    allowed_form_keys = _resolve_allowed_form_keys_for_user(doctor)
    if form_key not in allowed_form_keys:
        yield f"❌ Form '{form_key}' is not available for your expert profession."
        return
    form_def = next((f for f in ALL_FORMS_LIST if f["key"] == form_key), None)
    if not form_def:
        yield f"Error: Form with key '{form_key}' not found."
        return
    flattened_fields = _flatten_form_fields(form_def.get("schema", []))
    yield json.dumps({
        "form_key": form_def["key"],
        "title": form_def["title"],
        "description": form_def["description"],
        "fields": [
            {
                "name": field["name"],
                "label": field["label"],
                "type": field.get("type", "text"),
                "options": field.get("options"),
            }
            for field in flattened_fields
        ],
    }, ensure_ascii=False, indent=2)


@tool
async def submit_clinical_form(run_context: RunContext, form_key: str, **kwargs) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    blocked = _tool_family_error(doctor, "forms")
    if blocked:
        yield blocked
        return
    if not patient:
        yield "Error: No visitor selected."
        return
    allowed_form_keys = _resolve_allowed_form_keys_for_user(doctor)
    if form_key not in allowed_form_keys:
        yield f"❌ Form '{form_key}' is not available for your expert profession."
        return
    form_def = next((f for f in ALL_FORMS_LIST if f["key"] == form_key), None)
    if not form_def:
        yield f"Error: Invalid form_key '{form_key}'."
        return
    actual_data = kwargs.get("kwargs", kwargs) if "kwargs" in kwargs else kwargs
    active_case = await _get_active_case(patient, doctor)
    editable_error = await _ensure_case_editable(patient, doctor, active_case["id"])
    if editable_error:
        yield editable_error
        return
    timestamp = int(time.time())
    instance_key = f"clinical_form_{form_key.lower()}_{timestamp}"
    payload = {
        "form_key": form_key,
        "form_title": form_def["title"],
        "handler": "AgentTool",
        "submitted_by_doctor_id": int(active_case.get("doctor_id") or doctor.id),
        "submission_timestamp": timestamp,
        "visibility_scope": "SHARED_BASE" if form_key == "BASE_PROFILE_V1" else "CASE_PRIVATE",
        "case_id": None if form_key == "BASE_PROFILE_V1" else active_case["id"],
        **actual_data,
    }
    if form_key == "BASE_PROFILE_V1":
        await sync_to_async(CaseService.save_base_profile)(
            patient,
            payload,
            creator=doctor,
            source=UserContextEntry.SourceType.AGENT,
        )
    else:
        await sync_to_async(ContextDefinition.objects.get_or_create)(key=instance_key, defaults={"description": f"Agent submission: {form_def['title']}"})
        await sync_to_async(user_context_manager.add_entry)(user=patient, key=instance_key, data=payload, source=UserContextEntry.SourceType.AGENT, creator=doctor)
    if form_key == "BASE_PROFILE_V1" and payload.get("full_name"):
        patient.full_name = payload["full_name"]
        await sync_to_async(patient.save)(update_fields=["full_name"])
    if form_key != "BASE_PROFILE_V1":
        await sync_to_async(CaseService.touch_case)(patient, int(active_case.get("doctor_id") or doctor.id), active_case["id"])
    selected_case_id = active_case["id"]
    yield await _emit_canvas_refresh(run_context, patient, doctor, selected_case_id)
    yield "✅ Form submitted."


@tool
async def manage_clinical_tests(run_context: RunContext, action: str, data: Dict[str, Any] = {}) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    blocked = _tool_family_error(doctor, "tests")
    if blocked:
        yield blocked
        return
    if not patient:
        yield "Error: No visitor selected."
        return
    active_case = await _get_active_case(patient, doctor)
    editable_error = await _ensure_case_editable(patient, doctor, active_case["id"])
    if editable_error:
        yield editable_error
        return
    doctor_id = int(active_case.get("doctor_id") or doctor.id)
    policy = get_policy_for_user(doctor)
    action_key = (action or "").upper()
    if action_key == "ADD_TEST":
        if policy.get("test_mode") == "exams_only":
            if data.get("catalog_id"):
                yield "❌ General doctors can register only manual exam entries without catalog-based tests."
                return
            data = {**data, "url": ""}
        await sync_to_async(ClinicalTestsService.add_test)(
            patient, doctor, data.get("catalog_id"), data.get("title"), data.get("url"), None, doctor_id, active_case["id"]
        )
    elif action_key in {"UPDATE_SUMMARY", "UPDATE_RESULT_TEXT"}:
        updated = await sync_to_async(ClinicalTestsService.update_test)(
            patient,
            doctor,
            data.get("test_id"),
            {
                "result_text": data.get("result_text", data.get("result_summary", "")),
                "result_summary": data.get("result_text", data.get("result_summary", "")),
            },
            doctor_id,
            active_case["id"],
        )
        if not updated:
            yield "❌ Test not found."
            return
    elif action_key == "UPDATE_TEST":
        updated = await sync_to_async(ClinicalTestsService.update_test)(
            patient,
            doctor,
            data.get("test_id"),
            data,
            doctor_id,
            active_case["id"],
        )
        if not updated:
            yield "❌ Test not found."
            return
    elif action_key == "DELETE_TEST":
        deleted = await sync_to_async(ClinicalTestsService.delete_test)(
            patient, doctor, data.get("test_id"), doctor_id, active_case["id"]
        )
        if not deleted:
            yield "❌ Test not found."
            return
    else:
        yield f"❌ Unknown action '{action}'."
        return
    await sync_to_async(CaseService.touch_case)(patient, doctor_id, active_case["id"])
    yield await _emit_canvas_refresh(run_context, patient, doctor, active_case["id"])
    yield "✅ Clinical tests updated."


@tool
async def get_test_result_details(run_context: RunContext, test_id: str) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    blocked = _tool_family_error(doctor, "tests")
    if blocked:
        yield blocked
        return
    if not patient:
        yield "Error: No visitor selected."
        return
    active_case = await _get_active_case(patient, doctor)
    payload = await sync_to_async(ClinicalTestsService.read_test_result_bundle)(
        patient,
        test_id,
        int(active_case.get("doctor_id") or doctor.id),
        active_case["id"],
    )
    if not payload:
        yield "❌ Test not found."
        return
    yield json.dumps(payload, ensure_ascii=False, indent=2)


@tool
async def list_case_files(
    run_context: RunContext,
    page: int = 1,
    page_size: int = 10,
    query: str = "",
    file_type: str = "",
    readable_only: bool = False,
    sort: str = "recent",
) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    blocked = _tool_family_error(doctor, "files")
    if blocked:
        yield blocked
        return
    if not patient:
        yield "Error: No visitor selected."
        return
    active_case = await _get_active_case(patient, doctor)
    payload = await sync_to_async(CaseFilesService.list_files)(
        patient,
        int(active_case.get("doctor_id") or doctor.id),
        active_case["id"],
        page=page,
        page_size=page_size,
        query=query or None,
        file_type=file_type or None,
        readable_only=readable_only,
        sort=sort or "recent",
    )
    yield json.dumps(payload, ensure_ascii=False, indent=2)


@tool
async def search_case_files(
    run_context: RunContext,
    query: str,
    page: int = 1,
    page_size: int = 5,
    file_id: str = "",
) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    blocked = _tool_family_error(doctor, "files")
    if blocked:
        yield blocked
        return
    if not patient:
        yield "Error: No visitor selected."
        return
    active_case = await _get_active_case(patient, doctor)
    payload = await sync_to_async(CaseFilesService.search_files)(
        patient,
        int(active_case.get("doctor_id") or doctor.id),
        active_case["id"],
        query=query,
        page=page,
        page_size=page_size,
        file_id=file_id or None,
    )
    yield json.dumps(payload, ensure_ascii=False, indent=2)


@tool
async def read_case_file(
    run_context: RunContext,
    file_id: str,
    mode: str = "excerpt",
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    chunk_start: Optional[int] = None,
    chunk_count: int = 3,
    query: str = "",
) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    blocked = _tool_family_error(doctor, "files")
    if blocked:
        yield blocked
        return
    if not patient:
        yield "Error: No visitor selected."
        return
    active_case = await _get_active_case(patient, doctor)
    payload = await sync_to_async(CaseFilesService.read_file)(
        patient,
        int(active_case.get("doctor_id") or doctor.id),
        active_case["id"],
        file_id=file_id,
        mode=mode,
        page=page,
        page_size=page_size,
        chunk_start=chunk_start,
        chunk_count=chunk_count,
        query=query or None,
    )
    if not payload:
        yield "❌ File not found."
        return
    yield json.dumps(payload, ensure_ascii=False, indent=2)


@tool
async def get_case_file_details(run_context: RunContext, file_id: str) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    blocked = _tool_family_error(doctor, "files")
    if blocked:
        yield blocked
        return
    if not patient:
        yield "Error: No visitor selected."
        return
    active_case = await _get_active_case(patient, doctor)
    payload = await sync_to_async(CaseFilesService.get_file_details)(patient, int(active_case.get("doctor_id") or doctor.id), active_case["id"], file_id)
    if not payload:
        yield "❌ File not found."
        return
    yield json.dumps(payload, ensure_ascii=False, indent=2)


@tool
async def update_forms_tests_analysis(run_context: RunContext, analysis_text: str) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    blocked = _tool_family_error(doctor, "analysis")
    if blocked:
        yield blocked
        return
    if not patient:
        yield "Error: No visitor selected."
        return
    active_case = await _get_active_case(patient, doctor)
    editable_error = await _ensure_case_editable(patient, doctor, active_case["id"])
    if editable_error:
        yield editable_error
        return
    await sync_to_async(ProfileService.update_forms_tests_analysis)(patient, analysis_text, int(active_case.get("doctor_id") or doctor.id), active_case["id"])
    yield await _emit_canvas_refresh(run_context, patient, doctor, active_case["id"])
    yield "✅ تحلیل بالینی تست‌ها و فرم‌ها ذخیره شد."


@register_tool("vania_expert")
class VaniaExpertToolFactory(BaseCapability):
    def get_tools(self, user, session_id) -> List[Any]:
        tools = [
            get_my_expert_profile,
            get_active_visitor_profile,
            create_case,
            rename_case,
            delete_case,
            select_case,
            update_clinical_summary,
            manage_roadmap,
            finalize_session_report,
            add_rescue_task,
            manage_medications,
            get_current_medications,
            prescribe_resource,
            get_form_schema,
            submit_clinical_form,
            manage_clinical_tests,
            get_test_result_details,
            list_case_files,
            search_case_files,
            read_case_file,
            get_case_file_details,
            update_forms_tests_analysis,
        ]
        policy = get_policy_for_user(user)
        return [
            item
            for item in tools
            if is_tool_family_allowed(policy, TOOL_FAMILY_BY_NAME.get(item.__name__, "profiles"))
        ]

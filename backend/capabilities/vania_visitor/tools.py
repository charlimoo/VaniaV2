import json
import logging
from typing import Any, AsyncGenerator, List, Optional

from agno.run import RunContext
from agno.tools import tool
from agno.tools.function import ToolResult
from asgiref.sync import sync_to_async

from agents.context import selected_case_context, selected_doctor_context
from capabilities.test_attachment_media import (
    build_case_file_tool_result,
    build_test_attachment_tool_result,
    case_file_is_loadable,
    test_has_loadable_attachments,
)
from capabilities.base import BaseCapability
from canvas.events import CanvasUpdateEvent
from services.models_canvas import CanvasInstance
from users.models import CustomUser
from agents.storage import get_storage, get_session_safe
from vania_core.case_service import CaseService
from vania_core.medication_service import MedicationService
from vania_core.models import Notification, TreatmentConnection
from vania_core.patient_service import PatientDataService
from vania_core.profession_policy import get_profession_policy, is_tool_family_allowed
from vania_core.profile_snapshots import get_expert_profile_payload, get_visitor_base_profile_payload
from vania_core.services import AppendixService, TaskService
from vania_core.case_files_service import CaseFilesService
from vania_core.tests_service import ClinicalTestsService

logger = logging.getLogger(__name__)

TOOL_FAMILY_BY_NAME = {
    "get_my_visitor_profile": "profiles",
    "get_active_expert_profile": "profiles",
    "get_my_cases": "case_management",
    "get_my_case_snapshot": "case_management",
    "load_my_journey": "case_management",
    "select_case": "case_management",
    "mark_task_complete": "rescue_net",
    "mark_resource_consumed": "appendix",
    "reflect_on_session": "roadmap",
    "get_current_medications": "medications",
    "get_my_test_result_details": "tests",
    "get_my_test_attachment_details": "tests",
    "update_my_test_result": "tests",
    "manage_case_share": "case_management",
    "list_case_share_options": "case_management",
    "list_case_files": "files",
    "search_case_files": "files",
    "read_case_file": "files",
    "get_case_file_details": "files",
}


def _resolve_tool_name(tool_obj: Any) -> str:
    if hasattr(tool_obj, "name") and tool_obj.name:
        return str(tool_obj.name)
    entrypoint = getattr(tool_obj, "entrypoint", None)
    if entrypoint and hasattr(entrypoint, "__name__"):
        return str(entrypoint.__name__)
    if hasattr(tool_obj, "__name__"):
        return str(tool_obj.__name__)
    return ""


async def _resolve_selected_case(patient: CustomUser) -> Optional[dict]:
    cases = await sync_to_async(CaseService.get_accessible_cases_for_patient)(patient)
    selected_case_id = selected_case_context.get()
    if selected_case_id:
        for case_item in cases:
            if case_item.get("id") == selected_case_id:
                return case_item
    raw_doctor = selected_doctor_context.get()
    if raw_doctor:
        try:
            doctor_id = int(raw_doctor)
            match = next((item for item in cases if int(item.get("doctor_id") or 0) == doctor_id), None)
            if match:
                return match
        except (TypeError, ValueError):
            pass
    return cases[0] if cases else None


async def _get_persisted_selected_case(patient: CustomUser, session_id: Optional[str]) -> Optional[dict]:
    if not session_id:
        return None
    try:
        storage = get_storage()
        session = await sync_to_async(get_session_safe)(storage, session_id, str(patient.id))
        session_data = getattr(session, "session_data", None) or {}
        persisted_case_id = session_data.get("selected_case_id")
        if not persisted_case_id:
            return None
        cases = await sync_to_async(CaseService.get_accessible_cases_for_patient)(patient)
        return next((item for item in cases if item.get("id") == persisted_case_id), None)
    except Exception as exc:
        logger.warning("Failed to resolve persisted visitor case selection: %s", exc)
        return None


async def _resolve_selected_case_for_session(patient: CustomUser, session_id: Optional[str]) -> Optional[dict]:
    cases = await sync_to_async(CaseService.get_accessible_cases_for_patient)(patient)
    selected_case_id = selected_case_context.get()
    if selected_case_id:
        selected_case = next((item for item in cases if item.get("id") == selected_case_id), None)
        if selected_case:
            return selected_case
    raw_doctor = selected_doctor_context.get()
    if raw_doctor:
        try:
            doctor_id = int(raw_doctor)
            selected_case = next((item for item in cases if int(item.get("doctor_id") or 0) == doctor_id), None)
            if selected_case:
                return selected_case
        except (TypeError, ValueError):
            pass
    persisted_case = await _get_persisted_selected_case(patient, session_id)
    if persisted_case:
        return persisted_case
    return cases[0] if cases else None


async def _persist_case_selection(run_context: RunContext, case_item: Optional[dict]) -> None:
    if not run_context.session_id or not run_context.user_id:
        return
    try:
        storage = get_storage()
        session = await sync_to_async(get_session_safe)(storage, run_context.session_id, str(run_context.user_id))
        if not session:
            return
        if not getattr(session, "session_data", None):
            session.session_data = {}
        if case_item:
            doctor_id = case_item.get("doctor_id")
            doctor_name = case_item.get("doctor_name")
            session.session_data.update({
                "selected_case_id": case_item.get("id"),
                "selected_case_title": case_item.get("title"),
                "selected_case_doctor_name": doctor_name,
                "selected_case_doctor_profession_slug": case_item.get("doctor_profession_slug"),
                "selected_case_doctor_profession_label": case_item.get("doctor_profession_label"),
                "selected_expert_id": doctor_id,
                "selected_doctor_id": doctor_id,
                "selected_expert_name": doctor_name,
                "selected_doctor_name": doctor_name,
            })
        else:
            for key in (
                "selected_case_id",
                "selected_case_title",
                "selected_case_doctor_name",
                "selected_case_doctor_profession_slug",
                "selected_case_doctor_profession_label",
                "selected_expert_id",
                "selected_doctor_id",
                "selected_expert_name",
                "selected_doctor_name",
            ):
                session.session_data.pop(key, None)
        if hasattr(storage, "upsert_session"):
            await sync_to_async(storage.upsert_session)(session=session)
        else:
            await sync_to_async(storage.upsert)(session=session)
    except Exception as exc:
        logger.warning("Failed to persist visitor case selection: %s", exc)


async def _activate_case_selection(run_context: RunContext, case_item: dict) -> None:
    selected_case_context.set(case_item.get("id"))
    if case_item.get("doctor_id") is not None:
        selected_doctor_context.set(str(case_item.get("doctor_id")))
    await _persist_case_selection(run_context, case_item)


async def _get_active_patient(run_context: RunContext) -> CustomUser:
    return await CustomUser.objects.select_related("role").aget(pk=run_context.user_id)


async def _get_doctor_for_case(case_item: dict) -> CustomUser:
    return await CustomUser.objects.select_related("expert_profession", "role", "doctor_profile__location").aget(
        pk=case_item["doctor_id"]
    )


async def _get_canvas_id(session_id: str, component_key: str) -> Optional[str]:
    instance = await CanvasInstance.objects.filter(
        session_id=session_id,
        canvas_def__component_key=component_key
    ).afirst()
    return str(instance.id) if instance else None


async def _refresh_patient_canvas(session_id: str, patient: CustomUser, forced_case_id: Optional[str] = None) -> AsyncGenerator[Any, None]:
    if not session_id:
        return
    selected_case = await _resolve_selected_case_for_session(patient, session_id)
    if forced_case_id:
        selected_case = next((item for item in await sync_to_async(CaseService.get_accessible_cases_for_patient)(patient) if item.get("id") == forced_case_id), selected_case)
    data = await sync_to_async(PatientDataService.get_patient_dashboard_snapshot)(
        patient,
        int(selected_case["doctor_id"]) if selected_case else None,
        selected_case.get("id") if selected_case else None,
    )
    canvas_id = await _get_canvas_id(session_id, "VANIA_PATIENT_JOURNEY")
    yield CanvasUpdateEvent(value={
        "canvas_id": canvas_id,
        "component_key": "VANIA_PATIENT_JOURNEY",
        "delta": data,
    })


async def _get_selected_case_or_error(patient: CustomUser) -> tuple[Optional[dict], Optional[str]]:
    selected_case = await _resolve_selected_case(patient)
    if not selected_case:
        return None, "No active case found."
    return selected_case, None


async def _get_selected_case_or_error_for_session(patient: CustomUser, session_id: Optional[str]) -> tuple[Optional[dict], Optional[str]]:
    selected_case = await _resolve_selected_case_for_session(patient, session_id)
    if not selected_case:
        return None, "No active case found."
    return selected_case, None


async def _notify_doctor(patient: CustomUser, title: str, message: str, doctor_id: Optional[int] = None):
    @sync_to_async
    def send():
        qs = TreatmentConnection.objects.filter(
            patient=patient,
            status=TreatmentConnection.Status.ACTIVE
        ).select_related("doctor")
        conn = qs.filter(doctor_id=doctor_id).first() if doctor_id else qs.first()
        if conn and conn.doctor:
            Notification.objects.create(
                recipient=conn.doctor,
                sender=patient,
                type=Notification.Type.TASK_ASSIGNED,
                title=title,
                message=message,
                payload={"url": "/dashboard/patients"},
            )
    await send()


@tool
async def get_my_visitor_profile(run_context: RunContext) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient(run_context)
    payload = await sync_to_async(get_visitor_base_profile_payload)(patient)
    yield json.dumps(payload, ensure_ascii=False, indent=2)


@tool
async def get_active_expert_profile(run_context: RunContext) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient(run_context)
    selected_case = await _resolve_selected_case_for_session(patient, run_context.session_id)
    if not selected_case:
        yield "No active case found."
        return
    doctor = await _get_doctor_for_case(selected_case)
    payload = await sync_to_async(get_expert_profile_payload)(doctor)
    if not payload:
        yield "❌ Expert profile not found."
        return
    yield json.dumps(payload, ensure_ascii=False, indent=2)


@tool
async def load_my_journey(run_context: RunContext) -> AsyncGenerator[Any, None]:
    if not run_context.user_id:
        yield "Error: User context missing."
        return
    patient = await _get_active_patient(run_context)
    selected_case = await _resolve_selected_case_for_session(patient, run_context.session_id)
    if run_context.session_id:
        async for evt in _refresh_patient_canvas(run_context.session_id, patient):
            yield evt
    data = await sync_to_async(PatientDataService.get_patient_dashboard_snapshot)(
        patient,
        int(selected_case["doctor_id"]) if selected_case else None,
        selected_case.get("id") if selected_case else None,
    )
    yield json.dumps({
        "selected_case": {
            "id": data.get("selected_case_id"),
            "title": data.get("selected_case", {}).get("title"),
            "doctor_name": data.get("selected_case", {}).get("doctor_name"),
        },
        "pending_tasks_count": len([t for t in data.get("tasks", []) if t.get("status") == "PENDING"]),
        "library_items": len(data.get("library", [])),
        "timeline_count": len(data.get("timeline", [])),
    }, ensure_ascii=False, indent=2)


@tool
async def get_my_cases(run_context: RunContext) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient(run_context)
    cases = await sync_to_async(CaseService.get_accessible_cases_for_patient)(patient)
    active_case = await _resolve_selected_case_for_session(patient, run_context.session_id)
    yield json.dumps({
        "active_case_id": active_case.get("id") if active_case else None,
        "count": len(cases),
        "cases": cases,
    }, ensure_ascii=False, indent=2)


@tool
async def get_my_case_snapshot(run_context: RunContext, case_id: str = "") -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient(run_context)
    cases = await sync_to_async(CaseService.get_accessible_cases_for_patient)(patient)
    target_case = next((item for item in cases if item.get("id") == case_id), None) if case_id else None
    target_case = target_case or await _resolve_selected_case_for_session(patient, run_context.session_id)
    if not target_case:
        yield "❌ No accessible case found."
        return
    data = await sync_to_async(PatientDataService.get_patient_dashboard_snapshot)(
        patient,
        int(target_case["doctor_id"]),
        target_case["id"],
    )
    yield json.dumps({
        "case": data.get("selected_case", {}),
        "base_profile": data.get("base_profile", {}),
        "cases_count": len(data.get("cases", []) or []),
    }, ensure_ascii=False, indent=2)


@tool
async def select_case(run_context: RunContext, case_id: str) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient(run_context)
    case_item = next((item for item in await sync_to_async(CaseService.get_accessible_cases_for_patient)(patient) if item.get("id") == case_id), None)
    if not case_item:
        yield "❌ Case not found."
        return
    await _activate_case_selection(run_context, case_item)
    if run_context.session_id:
        async for evt in _refresh_patient_canvas(run_context.session_id, patient, case_id):
            yield evt
    yield f"✅ پرونده «{case_item['title']}» انتخاب شد."


@tool
async def mark_task_complete(run_context: RunContext, task_text_or_id: str, reflection: str = "") -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient(run_context)
    selected_case, error = await _get_selected_case_or_error_for_session(patient, run_context.session_id)
    if error:
        yield error
        return
    doctor_id = int(selected_case["doctor_id"])
    case_id = selected_case["id"]
    all_tasks = await sync_to_async(TaskService.get_patient_tasks)(patient, doctor_id, case_id)
    target_task = next((t for t in all_tasks if t.get("id") == task_text_or_id or task_text_or_id.lower() in t.get("text", "").lower()), None)
    if not target_task:
        yield f"Could not find a pending task matching '{task_text_or_id}'."
        return
    success = await sync_to_async(TaskService.update_task_status)(patient, target_task["id"], "DONE", reflection, doctor_id, case_id)
    if not success:
        yield "Failed to update task status."
        return
    if run_context.session_id:
        async for evt in _refresh_patient_canvas(run_context.session_id, patient):
            yield evt
    await _notify_doctor(patient, "تکلیف انجام شد", f"مراجع {patient.full_name} تکلیف «{target_task['text']}» را انجام داد.\nبازخورد: {reflection or 'ندارد'}", doctor_id)
    yield f"✅ Task '{target_task['text']}' marked as done."


@tool
async def mark_resource_consumed(run_context: RunContext, resource_title_or_id: str) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient(run_context)
    selected_case, error = await _get_selected_case_or_error_for_session(patient, run_context.session_id)
    if error:
        yield error
        return
    doctor_id = int(selected_case["doctor_id"])
    case_id = selected_case["id"]
    library = await sync_to_async(AppendixService.get_library)(patient, doctor_id, case_id)
    target = next((r for r in library.resources if r.id == resource_title_or_id or resource_title_or_id.lower() in r.title.lower()), None)
    if not target:
        yield f"Resource '{resource_title_or_id}' not found in your library."
        return
    success = await sync_to_async(AppendixService.update_resource_status)(patient, target.id, "CONSUMED", doctor_id, case_id)
    if not success:
        yield "Failed to update resource status."
        return
    if run_context.session_id:
        async for evt in _refresh_patient_canvas(run_context.session_id, patient):
            yield evt
    yield f"Marked '{target.title}' as consumed."


@tool
async def reflect_on_session(run_context: RunContext) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient(run_context)
    selected_case, _ = await _get_selected_case_or_error_for_session(patient, run_context.session_id)
    data = await sync_to_async(PatientDataService.get_patient_dashboard_snapshot)(
        patient,
        int(selected_case["doctor_id"]) if selected_case else None,
        selected_case.get("id") if selected_case else None,
    )
    timeline = data.get("timeline", [])
    if not timeline:
        yield "You haven't completed any sessions yet to reflect on."
        return
    last_session = timeline[0]
    yield json.dumps({
        "session_number": last_session.get("session_number"),
        "title": last_session.get("title"),
        "date": last_session.get("date"),
        "flashcards": last_session.get("flashcards", []),
        "public_summary": last_session.get("summary", ""),
    }, ensure_ascii=False, indent=2)


@tool
async def get_current_medications(run_context: RunContext) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient(run_context)
    selected_case, error = await _get_selected_case_or_error_for_session(patient, run_context.session_id)
    if error:
        yield error
        return
    plan = await sync_to_async(MedicationService.get_plan)(
        patient,
        int(selected_case["doctor_id"]),
        selected_case["id"],
    )
    yield json.dumps(plan.model_dump(), ensure_ascii=False, indent=2)


@tool
async def get_my_test_result_details(run_context: RunContext, test_id: str) -> ToolResult | str:
    """
    Read one saved test result and load any available attachment bytes into the current run context.

    Use this whenever the user asks what an attached PDF/image contains, including follow-up requests
    like "the PDF too", "check again", or "reopen the file". Do not claim you lack a PDF/file tool for
    test attachments while this tool is available. If an attachment exists but is not loadable, report
    that the specific attachment could not be loaded from storage.
    """
    patient = await _get_active_patient(run_context)
    selected_case, _ = await _get_selected_case_or_error_for_session(patient, run_context.session_id)
    test = await sync_to_async(ClinicalTestsService.get_test)(
        patient,
        test_id,
        int(selected_case["doctor_id"]) if selected_case else None,
        selected_case.get("id") if selected_case else None,
    )
    if not test:
        return "❌ Test not found."
    if test_has_loadable_attachments(test):
        return build_test_attachment_tool_result(test)
    payload = await sync_to_async(ClinicalTestsService.read_test_result_bundle)(
        patient,
        test_id,
        int(selected_case["doctor_id"]) if selected_case else None,
        selected_case.get("id") if selected_case else None,
    )
    if not payload:
        return "❌ Test not found."
    return ToolResult(content=json.dumps(payload, ensure_ascii=False, indent=2))


@tool
async def get_my_test_attachment_details(run_context: RunContext, test_id: str, attachment_id: str) -> ToolResult | str:
    """
    Read one specific saved test attachment and load only that attachment into the current run context.

    Use this when the user refers to a specific attachment type or file inside a test, such as "the PDF",
    "the image", or a specific attachment filename. If the selected attachment exists but cannot be loaded,
    report that exact attachment as unavailable instead of describing another attachment from the same test.
    """
    patient = await _get_active_patient(run_context)
    selected_case, _ = await _get_selected_case_or_error_for_session(patient, run_context.session_id)
    test = await sync_to_async(ClinicalTestsService.get_test)(
        patient,
        test_id,
        int(selected_case["doctor_id"]) if selected_case else None,
        selected_case.get("id") if selected_case else None,
    )
    if not test:
        return "❌ Test not found."
    attachment = await sync_to_async(ClinicalTestsService.get_test_attachment)(
        patient,
        test_id,
        attachment_id,
        int(selected_case["doctor_id"]) if selected_case else None,
        selected_case.get("id") if selected_case else None,
    )
    if not attachment:
        return "❌ Attachment not found."
    return build_test_attachment_tool_result(test, attachment_id=attachment_id)


@tool
async def update_my_test_result(
    run_context: RunContext,
    test_id: str,
    result_text: str,
) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient(run_context)
    selected_case, error = await _get_selected_case_or_error_for_session(patient, run_context.session_id)
    if error:
        yield error
        return
    doctor_id = int(selected_case["doctor_id"])
    case_id = selected_case["id"]
    current_test = await sync_to_async(ClinicalTestsService.get_test)(
        patient,
        test_id,
        doctor_id,
        case_id,
    )
    if current_test and current_test.get("source") == "interactive":
        yield "❌ این تست تعاملی است و نتیجه آن فقط با تکمیل آزمون در پلتفرم ثبت می‌شود."
        return
    updated = await sync_to_async(ClinicalTestsService.update_test)(
        patient=patient,
        created_by=patient,
        test_id=test_id,
        payload={
            "result_text": result_text,
            "result_summary": result_text,
        },
        doctor_id=doctor_id,
        case_id=case_id,
    )
    if not updated:
        yield "❌ Test not found."
        return
    if run_context.session_id:
        async for evt in _refresh_patient_canvas(run_context.session_id, patient):
            yield evt
    yield f"✅ Result for '{updated.get('title', 'test')}' updated."


@tool
async def list_case_share_options(run_context: RunContext) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient(run_context)
    selected_case, error = await _get_selected_case_or_error_for_session(patient, run_context.session_id)
    if error:
        yield error
        return
    payload = await sync_to_async(CaseService.get_case_share_options_for_patient)(patient, selected_case["id"])
    if not payload:
        yield "❌ Case share options are not available."
        return
    yield json.dumps(payload, ensure_ascii=False, indent=2)


@tool
async def manage_case_share(run_context: RunContext, action: str, expert_id: int) -> AsyncGenerator[Any, None]:
    patient = await _get_active_patient(run_context)
    selected_case, error = await _get_selected_case_or_error_for_session(patient, run_context.session_id)
    if error:
        yield error
        return
    action_key = (action or "").upper()
    if action_key == "GRANT_READ_ONLY":
        grantee = await CustomUser.objects.select_related("expert_profession", "role").aget(pk=expert_id)
        try:
            grant = await sync_to_async(CaseService.grant_read_only_access)(
                patient=patient,
                case_id=selected_case["id"],
                grantee_doctor=grantee,
                granted_by=patient,
            )
        except ValueError as exc:
            yield f"❌ {exc}"
            return
        if run_context.session_id:
            async for evt in _refresh_patient_canvas(run_context.session_id, patient):
                yield evt
        yield json.dumps(grant, ensure_ascii=False, indent=2)
        return
    if action_key == "REVOKE_READ_ONLY":
        revoked = await sync_to_async(CaseService.revoke_read_only_access)(
            patient,
            selected_case["id"],
            expert_id,
        )
        if not revoked:
            yield "❌ Share not found."
            return
        if run_context.session_id:
            async for evt in _refresh_patient_canvas(run_context.session_id, patient):
                yield evt
        yield "✅ Read-only share revoked."
        return
    yield f"❌ Unknown case share action '{action}'."


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
    patient = await _get_active_patient(run_context)
    selected_case, error = await _get_selected_case_or_error_for_session(patient, run_context.session_id)
    if error:
        yield error
        return
    payload = await sync_to_async(CaseFilesService.list_files)(
        patient,
        int(selected_case["doctor_id"]),
        selected_case["id"],
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
    patient = await _get_active_patient(run_context)
    selected_case, error = await _get_selected_case_or_error_for_session(patient, run_context.session_id)
    if error:
        yield error
        return
    payload = await sync_to_async(CaseFilesService.search_files)(
        patient,
        int(selected_case["doctor_id"]),
        selected_case["id"],
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
) -> ToolResult | str:
    patient = await _get_active_patient(run_context)
    selected_case, error = await _get_selected_case_or_error_for_session(patient, run_context.session_id)
    if error:
        return error
    payload = await sync_to_async(CaseFilesService.read_file)(
        patient,
        int(selected_case["doctor_id"]),
        selected_case["id"],
        file_id=file_id,
        mode=mode,
        page=page,
        page_size=page_size,
        chunk_start=chunk_start,
        chunk_count=chunk_count,
        query=query or None,
    )
    if not payload:
        return "❌ File not found."
    file_record = payload.get("file") if isinstance(payload, dict) else None
    if case_file_is_loadable(file_record):
        return build_case_file_tool_result(file_record, payload=payload)
    return ToolResult(content=json.dumps(payload, ensure_ascii=False, indent=2))


@tool
async def get_case_file_details(run_context: RunContext, file_id: str) -> ToolResult | str:
    patient = await _get_active_patient(run_context)
    selected_case, error = await _get_selected_case_or_error_for_session(patient, run_context.session_id)
    if error:
        return error
    payload = await sync_to_async(CaseFilesService.get_file_details)(patient, int(selected_case["doctor_id"]), selected_case["id"], file_id)
    if not payload:
        return "❌ File not found."
    if case_file_is_loadable(payload):
        return build_case_file_tool_result(payload)
    return ToolResult(content=json.dumps(payload, ensure_ascii=False, indent=2))


class VaniaVisitorToolFactory(BaseCapability):
    def get_tools(self, user, session_id) -> List:
        tools = [
            get_my_visitor_profile,
            get_active_expert_profile,
            get_my_cases,
            get_my_case_snapshot,
            load_my_journey,
            select_case,
            mark_task_complete,
            mark_resource_consumed,
            reflect_on_session,
            get_current_medications,
            get_my_test_result_details,
            get_my_test_attachment_details,
            update_my_test_result,
            list_case_share_options,
            manage_case_share,
            list_case_files,
            search_case_files,
            read_case_file,
            get_case_file_details,
        ]
        cases = CaseService.get_accessible_cases_for_patient(user)
        selected_case_id = selected_case_context.get()
        selected_case = next((item for item in cases if item.get("id") == selected_case_id), None) if selected_case_id else None
        selected_case = selected_case or (cases[0] if cases else None)
        profession_slug = selected_case.get("doctor_profession_slug") if selected_case else None
        policy = get_profession_policy(profession_slug)
        return [
            item
            for item in tools
            if is_tool_family_allowed(policy, TOOL_FAMILY_BY_NAME.get(_resolve_tool_name(item), "profiles"))
        ]

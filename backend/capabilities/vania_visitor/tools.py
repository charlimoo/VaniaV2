import json
import logging
from typing import Any, AsyncGenerator, List, Optional

from agno.run import RunContext
from agno.tools import tool
from asgiref.sync import sync_to_async

from agents.context import selected_case_context, selected_doctor_context
from capabilities.base import BaseCapability
from capabilities.registry import register_tool
from canvas.events import CanvasUpdateEvent
from services.models_canvas import CanvasInstance
from users.models import CustomUser
from vania_core.case_service import CaseService
from vania_core.medication_service import MedicationService
from vania_core.models import Notification, TreatmentConnection
from vania_core.patient_service import PatientDataService
from vania_core.profile_snapshots import get_expert_profile_payload, get_visitor_base_profile_payload
from vania_core.services import AppendixService, TaskService
from vania_core.case_files_service import CaseFilesService
from vania_core.tests_service import ClinicalTestsService

logger = logging.getLogger(__name__)


async def _resolve_selected_case(patient: CustomUser) -> Optional[dict]:
    selected_case_id = selected_case_context.get()
    cases = await sync_to_async(CaseService.get_accessible_cases_for_patient)(patient)
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


async def _get_canvas_id(session_id: str, component_key: str) -> Optional[str]:
    instance = await CanvasInstance.objects.filter(
        session_id=session_id,
        canvas_def__component_key=component_key
    ).afirst()
    return str(instance.id) if instance else None


async def _refresh_patient_canvas(session_id: str, patient: CustomUser, forced_case_id: Optional[str] = None) -> AsyncGenerator[Any, None]:
    if not session_id:
        return
    selected_case = await _resolve_selected_case(patient)
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
    patient = await CustomUser.objects.aget(pk=run_context.user_id)
    payload = await sync_to_async(get_visitor_base_profile_payload)(patient)
    yield json.dumps(payload, ensure_ascii=False, indent=2)


@tool
async def get_active_expert_profile(run_context: RunContext) -> AsyncGenerator[Any, None]:
    patient = await CustomUser.objects.aget(pk=run_context.user_id)
    selected_case = await _resolve_selected_case(patient)
    if not selected_case:
        yield "No active case found."
        return
    doctor = await CustomUser.objects.aget(pk=selected_case["doctor_id"])
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
    patient = await CustomUser.objects.aget(pk=run_context.user_id)
    selected_case = await _resolve_selected_case(patient)
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
async def select_case(run_context: RunContext, case_id: str) -> AsyncGenerator[Any, None]:
    patient = await CustomUser.objects.aget(pk=run_context.user_id)
    case_item = next((item for item in await sync_to_async(CaseService.get_accessible_cases_for_patient)(patient) if item.get("id") == case_id), None)
    if not case_item:
        yield "❌ Case not found."
        return
    if run_context.session_id:
        async for evt in _refresh_patient_canvas(run_context.session_id, patient, case_id):
            yield evt
    yield f"✅ پرونده «{case_item['title']}» انتخاب شد."


@tool
async def mark_task_complete(run_context: RunContext, task_text_or_id: str, reflection: str = "") -> AsyncGenerator[Any, None]:
    patient = await CustomUser.objects.aget(pk=run_context.user_id)
    selected_case = await _resolve_selected_case(patient)
    if not selected_case:
        yield "No active case found."
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
    patient = await CustomUser.objects.aget(pk=run_context.user_id)
    selected_case = await _resolve_selected_case(patient)
    if not selected_case:
        yield "No active case found."
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
    patient = await CustomUser.objects.aget(pk=run_context.user_id)
    selected_case = await _resolve_selected_case(patient)
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
    patient = await CustomUser.objects.aget(pk=run_context.user_id)
    selected_case = await _resolve_selected_case(patient)
    if not selected_case:
        yield "No active case found."
        return
    plan = await sync_to_async(MedicationService.get_plan)(
        patient,
        int(selected_case["doctor_id"]),
        selected_case["id"],
    )
    yield json.dumps(plan.model_dump(), ensure_ascii=False, indent=2)


@tool
async def get_my_test_result_details(run_context: RunContext, test_id: str) -> AsyncGenerator[Any, None]:
    patient = await CustomUser.objects.aget(pk=run_context.user_id)
    selected_case = await _resolve_selected_case(patient)
    payload = await sync_to_async(ClinicalTestsService.read_test_result_bundle)(
        patient,
        test_id,
        int(selected_case["doctor_id"]) if selected_case else None,
        selected_case.get("id") if selected_case else None,
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
    patient = await CustomUser.objects.aget(pk=run_context.user_id)
    selected_case = await _resolve_selected_case(patient)
    if not selected_case:
        yield "No active case found."
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
    patient = await CustomUser.objects.aget(pk=run_context.user_id)
    selected_case = await _resolve_selected_case(patient)
    if not selected_case:
        yield "No active case found."
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
) -> AsyncGenerator[Any, None]:
    patient = await CustomUser.objects.aget(pk=run_context.user_id)
    selected_case = await _resolve_selected_case(patient)
    if not selected_case:
        yield "No active case found."
        return
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
        yield "❌ File not found."
        return
    yield json.dumps(payload, ensure_ascii=False, indent=2)


@tool
async def get_case_file_details(run_context: RunContext, file_id: str) -> AsyncGenerator[Any, None]:
    patient = await CustomUser.objects.aget(pk=run_context.user_id)
    selected_case = await _resolve_selected_case(patient)
    if not selected_case:
        yield "No active case found."
        return
    payload = await sync_to_async(CaseFilesService.get_file_details)(patient, int(selected_case["doctor_id"]), selected_case["id"], file_id)
    if not payload:
        yield "❌ File not found."
        return
    yield json.dumps(payload, ensure_ascii=False, indent=2)


@register_tool("vania_visitor")
class VaniaVisitorToolFactory(BaseCapability):
    def get_tools(self, user, session_id) -> List:
        return [
            get_my_visitor_profile,
            get_active_expert_profile,
            load_my_journey,
            select_case,
            mark_task_complete,
            mark_resource_consumed,
            reflect_on_session,
            get_current_medications,
            get_my_test_result_details,
            list_case_files,
            search_case_files,
            read_case_file,
            get_case_file_details,
        ]

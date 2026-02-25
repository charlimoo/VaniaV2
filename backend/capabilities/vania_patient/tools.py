# backend/capabilities/vania_patient/tools.py
import json
import logging
from typing import List, Optional, AsyncGenerator, Any

from agno.tools import tool
from agno.run import RunContext
from asgiref.sync import sync_to_async

# --- Capability Registry ---
from capabilities.base import BaseCapability
from capabilities.registry import register_tool
from canvas.events import CanvasUpdateEvent

# --- Vania Core Services & Models ---
from users.models import CustomUser
from vania_core.models import Notification, TreatmentConnection
from vania_core.patient_service import PatientDataService
from vania_core.task_service import TaskService
from vania_core.appendix_service import AppendixService
from agents.context import selected_doctor_context

logger = logging.getLogger(__name__)


async def _resolve_selected_doctor_id(patient: CustomUser) -> Optional[int]:
    raw = selected_doctor_context.get()
    if raw:
        try:
            selected = int(raw)
            has_access = await sync_to_async(
                lambda: TreatmentConnection.objects.filter(
                    patient=patient,
                    doctor_id=selected,
                    status=TreatmentConnection.Status.ACTIVE
                ).exists()
            )()
            if has_access:
                return selected
        except (TypeError, ValueError):
            pass
    conn = await sync_to_async(
        lambda: TreatmentConnection.objects.filter(
            patient=patient,
            status=TreatmentConnection.Status.ACTIVE
        ).order_by("-updated_at").first()
    )()
    return conn.doctor_id if conn else None

# ==============================================================================
# == HELPER FUNCTIONS
# ==============================================================================

async def _refresh_patient_canvas(session_id: str, patient: CustomUser) -> AsyncGenerator[Any, None]:
    """
    Asynchronously fetches fresh patient data and pushes a CanvasUpdateEvent
    to the frontend to keep the UI in sync with the backend state.
    """
    if not session_id:
        return

    try:
        doctor_id = await _resolve_selected_doctor_id(patient)
        data = await sync_to_async(PatientDataService.get_patient_dashboard_snapshot)(patient, doctor_id)

        yield CanvasUpdateEvent(value={
            "component_key": "VANIA_PATIENT_JOURNEY",
            "delta": {
                "tasks": data["tasks"],
                "timeline": data["timeline"],
                "library": data["library"],
                "active_goals": data["active_goals"],
                "my_doctors": data.get("my_doctors", []),
                "selected_doctor_id": data.get("selected_doctor_id"),
            }
        })
    except Exception as e:
        logger.error(f"Failed to refresh patient canvas: {e}")

async def _notify_doctor(patient: CustomUser, title: str, message: str, doctor_id: Optional[int] = None):
    """
    Sends a system notification to the patient's active doctor.
    Used when tasks are completed or important milestones are reached.
    """
    try:
        @sync_to_async
        def send():
            # Find the primary active connection
            qs = TreatmentConnection.objects.filter(
                patient=patient, 
                status=TreatmentConnection.Status.ACTIVE
            ).select_related('doctor')
            if doctor_id:
                conn = qs.filter(doctor_id=doctor_id).first()
            else:
                conn = qs.first()
            
            if conn and conn.doctor:
                Notification.objects.create(
                    recipient=conn.doctor,
                    sender=patient,
                    type=Notification.Type.TASK_ASSIGNED, # Or a generic type
                    title=title,
                    message=message,
                    payload={"url": "/dashboard/patients"} # Deep link to doctor dashboard
                )
        await send()
    except Exception as e:
        logger.error(f"Failed to notify doctor: {e}")

# ==============================================================================
# == TOOLS
# ==============================================================================

@tool
async def load_my_journey(run_context: RunContext) -> AsyncGenerator[Any, None]:
    """
    Loads the user's complete context (Tasks, History, Library, Goals).
    Use this at the start of the conversation to understand the patient's current status.
    """
    user_id = run_context.user_id
    if not user_id: 
        yield "Error: User context missing."
        return
    
    try:
        patient = await CustomUser.objects.aget(pk=user_id)
        doctor_id = await _resolve_selected_doctor_id(patient)

        # 1. Trigger UI Refresh
        if run_context.session_id:
            async for evt in _refresh_patient_canvas(run_context.session_id, patient):
                yield evt

        # 2. Return Context to LLM
        data = await sync_to_async(PatientDataService.get_patient_dashboard_snapshot)(patient, doctor_id)
        
        # Summarize to save tokens while providing key info
        context_summary = {
            "current_phase": data["current_phase"],
            "active_goals_count": len(data["active_goals"]),
            "active_goals_preview": data["active_goals"][:3],
            "pending_tasks_count": len([t for t in data['tasks'] if t['status'] == 'PENDING']),
            "next_task": next((t['text'] for t in data['tasks'] if t['status'] == 'PENDING'), None),
            "unread_library_items": len([r for r in data['library'] if r.status == 'SUGGESTED']),
            "last_session_date": data['timeline'][0]['date'] if data['timeline'] else None
        }

        yield json.dumps(context_summary, ensure_ascii=False, indent=2)

    except Exception as e:
        logger.error(f"Error loading journey: {e}")
        yield "An error occurred while loading your profile."

@tool
async def mark_task_complete(
    run_context: RunContext, 
    task_text_or_id: str, 
    reflection: str = ""
) -> AsyncGenerator[Any, None]:
    """
    Marks a specific task from the 'Rescue Net' (Tour-e Nejat) as completed.
    
    Args:
        task_text_or_id: The exact text or ID of the task.
        reflection: Optional user thoughts or feelings about the task.
    """
    user_id = run_context.user_id
    patient = await CustomUser.objects.aget(pk=user_id)
    doctor_id = await _resolve_selected_doctor_id(patient)

    # Find the task
    all_tasks = await sync_to_async(TaskService.get_patient_tasks)(patient, doctor_id)
    target_task = next((t for t in all_tasks if t.get('id') == task_text_or_id or task_text_or_id.lower() in t.get('text', '').lower()), None)
            
    if not target_task:
        yield f"Could not find a pending task matching '{task_text_or_id}'."
        return

    # Update Status
    success = await sync_to_async(TaskService.update_task_status)(
        patient, target_task['id'], "DONE", reflection, doctor_id
    )

    if success:
        # 1. Update Patient Canvas
        if run_context.session_id:
            async for evt in _refresh_patient_canvas(run_context.session_id, patient):
                yield evt
        
        # 2. Notify Doctor
        await _notify_doctor(
            patient, 
            "تکلیف انجام شد", 
            f"مراجعه کننده {patient.full_name} تکلیف «{target_task['text']}» را انجام داد.\nبازخورد: {reflection or 'ندارد'}",
            doctor_id=doctor_id
        )

        yield f"✅ Task '{target_task['text']}' marked as done. I have notified Dr. {target_task.get('doctor_name', 'Doctor')}."
    else:
        yield "Failed to update task status in the database."

@tool
async def mark_resource_consumed(
    run_context: RunContext,
    resource_title_or_id: str
) -> AsyncGenerator[Any, None]:
    """
    Marks a book, movie, or poem from the 'Thought Appendix' (Library) as read/watched.
    """
    user_id = run_context.user_id
    patient = await CustomUser.objects.aget(pk=user_id)
    doctor_id = await _resolve_selected_doctor_id(patient)
    
    library = await sync_to_async(AppendixService.get_library)(patient, doctor_id)
    
    target = next((r for r in library.resources if r.id == resource_title_or_id or resource_title_or_id.lower() in r.title.lower()), None)
    
    if not target:
        yield f"Resource '{resource_title_or_id}' not found in your library."
        return

    success = await sync_to_async(AppendixService.update_resource_status)(
        patient, target.id, "CONSUMED", doctor_id
    )
    
    if success:
        # Update UI
        if run_context.session_id:
            async for evt in _refresh_patient_canvas(run_context.session_id, patient):
                yield evt
        
        yield f"Marked '{target.title}' as consumed. Ask the user reflective questions about it."
    else:
        yield "Failed to update resource status."

@tool
async def reflect_on_session(run_context: RunContext) -> AsyncGenerator[Any, None]:
    """
    Retrieves the summary and flashcards of the LAST completed session.
    Use this to help the patient journal or review what they learned.
    """
    user_id = run_context.user_id
    patient = await CustomUser.objects.aget(pk=user_id)
    doctor_id = await _resolve_selected_doctor_id(patient)
    
    # Fetch aggregated data
    data = await sync_to_async(PatientDataService.get_patient_dashboard_snapshot)(patient, doctor_id)
    timeline = data.get("timeline", [])
    
    if not timeline:
        yield "You haven't completed any sessions yet to reflect on."
        return

    last_session = timeline[0] # Newest first (reverse order in service)
    
    # Construct response for the LLM
    response = {
        "session_number": last_session['session_number'],
        "title": last_session['title'],
        "date": last_session['date'],
        "flashcards": last_session['flashcards'],
        "public_summary": last_session['summary'],
        "guidance": "Ask the user which of these techniques they practiced this week."
    }
    
    yield json.dumps(response, ensure_ascii=False, indent=2)

# ==============================================================================
# == FACTORY
# ==============================================================================

@register_tool("vania_patient")
class VaniaPatientToolFactory(BaseCapability):
    """
    Factory class that provides the tools for the Vania Patient Agent.
    """

    def get_tools(self, user, session_id) -> List:
        return [
            load_my_journey,
            mark_task_complete,
            mark_resource_consumed,
            reflect_on_session
        ]

# backend/capabilities/vania_doctor/tools.py
import json
import logging
import time
from typing import List, Optional, AsyncGenerator, Any, Dict
from django.utils import timezone
from asgiref.sync import sync_to_async

# --- Agno Imports ---
from agno.tools import tool
from agno.run import RunContext

# --- Capability System Imports ---
from capabilities.base import BaseCapability
from capabilities.registry import register_tool
from canvas.events import CanvasUpdateEvent 

# --- Core Vania Models & Context ---
from agents.context import resource_context
from users.models import CustomUser, UserContextEntry, ContextDefinition
from users.services import user_context_manager
from vania_core.services import (
    RoadmapService, 
    AppendixService, 
    SessionService, 
    TaskService,
    ProfileService,
    ClinicalTestsService,
)
from vania_core.schemas import TherapyPhase, SessionStatus
from services.models_canvas import CanvasInstance # [FIX] Added Import

# --- Form Definitions ---
from .forms import ALL_FORMS_LIST

# Configure Logger
logger = logging.getLogger(__name__)

# ==========================================
# 1. HELPER FUNCTIONS
# ==========================================

async def _get_active_patient() -> Optional[CustomUser]:
    """
    Retrieves the patient object locked to the current request context via the 'X-Target-Resource-ID' header.
    This is a critical security and context helper used by almost every tool.
    
    Returns:
        The CustomUser object for the patient, or None if no patient is selected.
    """
    patient_id = resource_context.get()
    if not patient_id:
        return None
    try:
        # Asynchronously fetch the user from the database
        return await CustomUser.objects.aget(pk=patient_id)
    except CustomUser.DoesNotExist:
        logger.warning(f"Tool attempted to access non-existent patient ID: {patient_id}")
        return None

async def _get_canvas_id(session_id: str, component_key: str) -> Optional[str]:
    """
    [FIX] Resolves the specific Canvas Instance UUID for the current session.
    This is required for the frontend to know exactly which tab to update.
    """
    try:
        # We use filter().afirst() to get the instance asynchronously
        instance = await CanvasInstance.objects.filter(
            session_id=session_id,
            canvas_def__component_key=component_key
        ).afirst()
        
        return str(instance.id) if instance else None
    except Exception as e:
        logger.error(f"❌ Failed to resolve canvas ID for session {session_id}: {e}")
        return None

# ==========================================
# 2. PHASE 1: PROFILE MANAGEMENT TOOL
# ==========================================

@tool
async def update_clinical_summary(
    run_context: RunContext,
    summary_text: str
) -> AsyncGenerator[Any, None]:
    """
    Updates the main 'Clinical Summary' text field in the patient's profile tab.
    Use this to synthesize the patient's history, TAT/Rorschach observations, or core problem formulation.
    This text is directly visible to the doctor in the UI.
    
    Args:
        summary_text: The full, updated text for the clinical summary.
    """
    patient = await _get_active_patient()
    if not patient: 
        yield "Error: No patient is selected. A patient must be active to update their profile."
        return

    # 1. Persist Data
    await sync_to_async(ProfileService.update_summary)(patient, summary_text)
    
    # 2. Explicit UI Sync
    # [FIX] Resolve Canvas ID
    canvas_id = await _get_canvas_id(run_context.session_id, "VANIA_PATIENT_MANAGER")
    
    yield CanvasUpdateEvent(value={
        "canvas_id": canvas_id, # [FIX] Required by Frontend
        "component_key": "VANIA_PATIENT_MANAGER",
        "delta": {
            "clinical_summary": summary_text
        }
    })
    
    yield "✅ The patient's clinical summary has been updated in their profile."

# ==========================================
# 3. PHASE 2/3: KNOWLEDGE & STRATEGY
# ==========================================

# NOTE: The 'search_clinical_protocol' tool has been removed.
# The Agent is now instructed to rely on its internal expert clinical knowledge 
# to propose and define treatment approaches.

# ==========================================
# 4. PHASE 4 & BEYOND: ROADMAP MANAGEMENT
# ==========================================

@tool
async def manage_roadmap(
    run_context: RunContext,
    action: str, 
    data: Dict[str, Any] = {} 
) -> AsyncGenerator[Any, None]:
    """
    [PHASE MANAGEMENT] Manages the Therapy Roadmap and current phase.
    Use this to transition between phases, plan future sessions, or set the treatment strategy.
    
    Args:
        action: The operation to perform. Must be one of:
                - "INITIALIZE": Resets the roadmap to Phase 1.
                - "SET_PHASE": Moves the patient to a specific phase (e.g., data={'phase': 'PHASE_2_APPROACHES'}).
                - "ADD_SESSION": Plans a future session, saving the AI's private instructions for the doctor (data={'title': '...', 'instructions': '...'}).
                - "UPDATE_STRATEGY": Saves the list of chosen therapy approaches to the roadmap (data={'approaches': ['CBT', 'ACT']}).
    """
    patient = await _get_active_patient()
    if not patient: 
        yield "Error: No patient selected."
        return

    # --- Action Dispatcher ---
    if action.upper() == "INITIALIZE":
        await sync_to_async(RoadmapService.get_or_create_roadmap)(patient)
        yield "✅ Roadmap initialized and set to Phase 1."

    elif action.upper() == "SET_PHASE":
        phase_str = data.get("phase")
        if phase_str:
            try:
                phase_enum = TherapyPhase(phase_str)
                await sync_to_async(RoadmapService.update_phase)(patient, phase_enum)
                yield f"✅ Phase updated to: {phase_str}"
            except ValueError:
                yield f"❌ Invalid Phase provided: '{phase_str}'"
        else:
            yield "❌ Missing 'phase' in data payload for SET_PHASE action."

    elif action.upper() == "ADD_SESSION":
        # Smart default for title if Agent forgets
        roadmap_current = await sync_to_async(RoadmapService.get_or_create_roadmap)(patient)
        next_num = len(roadmap_current.sessions) + 1
        
        title = data.get("title")
        if not title:
            title = f"جلسه {next_num}"
            logger.warning(f"Agent forgot title for session {next_num}. Using default.")

        instructions = data.get("instructions", "No specific protocol instructions provided.")
        
        scheduled_date = data.get("scheduled_date")
        await sync_to_async(RoadmapService.add_session)(patient, title, instructions, scheduled_date)
        yield f"✅ Session '{title}' added to the roadmap."

    elif action.upper() == "UPDATE_STRATEGY":
        approaches = data.get("approaches", [])
        if approaches and isinstance(approaches, list):
            # We fetch, update locally, and save using the service primitive
            roadmap_to_update = await sync_to_async(RoadmapService.get_or_create_roadmap)(patient)
            roadmap_to_update.treatment_approaches = approaches
            await sync_to_async(RoadmapService.save_roadmap)(patient, roadmap_to_update)
            yield f"✅ Treatment strategy saved: {', '.join(approaches)}"
        else:
            yield "❌ Missing or invalid 'approaches' list in data payload."

    else:
        yield f"❌ Unknown action for manage_roadmap: '{action}'"

    # --- Explicit UI Sync ---
    # Fetch the authoritative state from DB after modification and push to frontend
    updated_roadmap = await sync_to_async(RoadmapService.get_or_create_roadmap)(patient)
    
    # [FIX] Resolve Canvas ID
    canvas_id = await _get_canvas_id(run_context.session_id, "VANIA_PATIENT_MANAGER")

    yield CanvasUpdateEvent(value={
        "canvas_id": canvas_id, # [FIX] Required
        "component_key": "VANIA_PATIENT_MANAGER",
        "delta": {
            "roadmap_data": updated_roadmap.model_dump()
        }
    })


# ==========================================
# 5. PHASE 5: EXECUTION & REPORTING
# ==========================================

@tool
async def finalize_session_report(
    run_context: RunContext,
    session_number: int,
    topic: str,
    swot: Dict[str, List[str]],
    smart_goals: List[str],
    flashcards: List[Dict[str, str]],
    summary: str,
    private_notes: str = ""
) -> AsyncGenerator[Any, None]:
    """
    [PHASE 5] Generates the formal 'Session Support Document' (سند پشتیبان), saves it,
    and marks the session as COMPLETED on the roadmap.
    
    Args:
        session_number: The number of the session being reported.
        topic: The main subject discussed.
        swot: A dict with keys 'Strengths', 'Weaknesses', 'Opportunities', 'Threats'.
        smart_goals: A list of SMART goals set for the patient.
        flashcards: A list of dicts {"title": "...", "content": "..."} for patient reminders.
        summary: A narrative summary of the session.
        private_notes: Confidential notes visible only to the doctor.
    """
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    
    if not patient: 
        yield "Error: No patient selected."
        return

    # 1. Structure the payload into a rich JSON object
    rich_payload = {
        "is_structured_report": True,
        "session_number": session_number,
        "topic": topic,
        "date": timezone.now().strftime('%Y-%m-%d'),
        "approaches_used": [], # Placeholder, could be populated from roadmap
        "symptoms_analysis": summary, # Using summary as a base for analysis
        "swot_analysis": swot,
        "smart_goals": smart_goals,
        "flashcards": flashcards,
    }
    
    # 2. Save the structured report to the session history log
    log_entry = await sync_to_async(SessionService.log_session)(
        patient=patient,
        doctor=doctor,
        summary=json.dumps(rich_payload, ensure_ascii=False),
        private_notes=private_notes
    )
    
    # 3. Update the roadmap: Mark session as COMPLETED and link the report ID
    await sync_to_async(RoadmapService.complete_session)(
        patient, 
        session_number, 
        doc_id=str(log_entry.id)
    )
    
    # 4. Explicit UI Sync (Multi-Pillar Update)
    # This tool affects both the Roadmap (status change) and the Session History list.
    updated_roadmap = await sync_to_async(RoadmapService.get_or_create_roadmap)(patient)
    updated_history = await sync_to_async(SessionService.get_patient_history)(patient, viewer_role='DOCTOR')

    # [FIX] Resolve Canvas ID
    canvas_id = await _get_canvas_id(run_context.session_id, "VANIA_PATIENT_MANAGER")

    yield CanvasUpdateEvent(value={
        "canvas_id": canvas_id, # [FIX] Required
        "component_key": "VANIA_PATIENT_MANAGER",
        "delta": {
            "roadmap_data": updated_roadmap.model_dump(),
            "sessions": updated_history,
            # We also update active_goals for the UI since this session might have new ones
            "active_goals": smart_goals
        }
    })
        
    yield f"✅ Session {session_number} report finalized and linked to the Roadmap."

@tool
async def add_rescue_task(
    run_context: RunContext,
    text: str,
    dimension: str,
    due_date: str = None
) -> AsyncGenerator[Any, None]:
    """
    [PHASE 5] Adds a task to the patient's 'Rescue Net' (Tour-e Nejat).
    
    Args:
        text: The content of the task (e.g., "Practice mindfulness for 10 minutes").
        dimension: ONE of the 9 dimensions: "PERSONAL", "RELATIONSHIP", "CAREER", "EMOTIONAL",
                   "INTELLECTUAL", "FRIENDSHIP", "ENVIRONMENT", "SOLITUDE", "RECREATION".
        due_date: Optional date string (e.g., "1403/05/20").
    """
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    
    if not patient:
        yield "Error: No patient selected."
        return

    # 1. Perform Write
    await sync_to_async(TaskService.assign_task)(
        patient=patient,
        doctor=doctor,
        text=text,
        due_date=due_date,
        dimension=dimension.upper() # Ensure consistency with Enum
    )
    
    # 2. Explicit UI Sync
    # We fetch the WHOLE task list because the frontend merges arrays by overwriting.
    all_tasks = await sync_to_async(TaskService.get_patient_tasks)(patient)
    
    # [FIX] Resolve Canvas ID
    canvas_id = await _get_canvas_id(run_context.session_id, "VANIA_PATIENT_MANAGER")

    yield CanvasUpdateEvent(value={
        "canvas_id": canvas_id, # [FIX] Required
        "component_key": "VANIA_PATIENT_MANAGER",
        "delta": {
            "tasks": all_tasks
        }
    })
        
    yield f"✅ Task added to the '{dimension}' dimension: '{text}'"


# ==========================================
# 6. PHASE 6: THOUGHT APPENDIX
# ==========================================

@tool
async def prescribe_resource(
    run_context: RunContext,
    type: str, 
    title: str,
    creator: str,
    reason: str,
    excerpt: str = ""
) -> AsyncGenerator[Any, None]:
    """
    [PHASE 6] Prescribes a cultural resource to the 'Thought Appendix' (پیوست اندیشه).
    
    Args:
        type: The type of resource. Must be one of "BOOK", "POEM", "MOVIE".
        title: The title of the work (e.g., "Man's Search for Meaning").
        creator: The author, poet, or director (e.g., "Viktor Frankl").
        reason: The therapeutic reason for this prescription, tailored to the patient.
        excerpt: A short, impactful quote or verse (optional).
    """
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    
    if not patient:
        yield "Error: No patient selected."
        return
    
    resource_data = {
        "type": type.upper(), # Ensure Enum compatibility
        "title": title,
        "creator": creator,
        "reason_for_prescription": reason,
        "content_excerpt": excerpt
    }
    
    # 1. Perform Write
    await sync_to_async(AppendixService.add_resource)(patient, doctor, resource_data)
    
    # 2. Explicit UI Sync
    updated_library = await sync_to_async(AppendixService.get_library)(patient)
    
    # [FIX] Resolve Canvas ID
    canvas_id = await _get_canvas_id(run_context.session_id, "VANIA_PATIENT_MANAGER")

    yield CanvasUpdateEvent(value={
        "canvas_id": canvas_id, # [FIX] Required
        "component_key": "VANIA_PATIENT_MANAGER",
        "delta": {
            "appendix_data": updated_library.model_dump()
        }
    })
        
    yield f"✅ Prescribed {type}: '{title}' has been added to the Thought Appendix."


# ==========================================
# 7. CLINICAL FORMS AUTOMATION
# ==========================================

@tool
async def get_form_schema(
    run_context: RunContext,
    form_key: str
) -> AsyncGenerator[Any, None]:
    """
    [PERCEPTION] Retrieves the structure (schema) of a clinical form.
    Use this tool FIRST to understand which questions need to be answered before
    you can use 'submit_clinical_form'.
    
    Args:
        form_key: The unique ID of the form (e.g., "PSYCHOLOGY_V1", "SOCIAL_V1").
    """
    form_def = next((f for f in ALL_FORMS_LIST if f['key'] == form_key), None)
    
    if not form_def:
        yield f"Error: Form with key '{form_key}' not found. Please use one of the available form keys."
        return

    # Return a structured JSON string of the schema for the LLM to parse
    schema_info = {
        "form_key": form_def["key"],
        "title": form_def["title"],
        "description": form_def["description"],
        "fields": [
            {
                "name": field["name"],
                "label": field["label"],
                "type": field.get("type", "text"),
                "options": field.get("options") # Will be null if not a select
            } for field in form_def["schema"]
        ]
    }
    
    yield json.dumps(schema_info, ensure_ascii=False, indent=2)
    
@tool
async def submit_clinical_form(
    run_context: RunContext,
    form_key: str,
    **kwargs
) -> AsyncGenerator[Any, None]:
    """
    [ACTION] Fills and submits a structured clinical form for the active patient.
    The fields from the form should be passed as direct keyword arguments.
    
    Args:
        form_key: The unique ID of the form (e.g., "PSYCHOLOGY_V1", "SOCIAL_V1").
        **kwargs: The fields of the form. For example: referral_agent="Dr. Smith", referral_reason="..."
    """
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)
    
    if not patient:
        yield "Error: No patient selected."
        return

    form_def = next((f for f in ALL_FORMS_LIST if f['key'] == form_key), None)
    if not form_def:
        yield f"Error: Invalid form_key '{form_key}'."
        return
    
    # --- [FIX] FLATTEN DATA ---
    # If the LLM passed data inside a key literally named 'kwargs'
    actual_data = kwargs.get('kwargs', kwargs) if 'kwargs' in kwargs else kwargs
    
    if not actual_data:
        yield "Error: No form data provided."
        return

    timestamp = int(time.time())
    instance_key = f"clinical_form_{form_key.lower()}_{timestamp}"
    
    final_data = {
        "form_key": form_key,
        "form_title": form_def['title'],
        "handler": "AgentTool",
        "submitted_by_doctor_id": doctor.id,
        "submission_timestamp": timestamp,
        **actual_data  # [FIX] Use the flattened data
    }

    await sync_to_async(ContextDefinition.objects.get_or_create)(
        key=instance_key,
        defaults={'description': f"Agent submission: {form_def['title']}"}
    )

    await sync_to_async(user_context_manager.add_entry)(
        user=patient,
        key=instance_key,
        data=final_data,
        source=UserContextEntry.SourceType.AGENT,
        creator=doctor
    )

    # [FIX] Define the synchronous database query inside a dedicated function
    @sync_to_async
    def get_forms_history_sync(patient_user):
        # Use select_related to pre-fetch the 'definition' object in the same query
        return list(UserContextEntry.objects.filter(
            user=patient_user, 
            definition__key__startswith="clinical_form_"
        ).select_related('definition').order_by('-created_at'))

    # Now call the async version of that function
    form_entries = await get_forms_history_sync(patient)

    forms_history = []
    # This loop is now safe because 'f.definition' is pre-loaded
    for f in form_entries:
        forms_history.append({
            "id": str(f.id),
            "form_key": f.data.get('form_key'),
            "type": f.data.get('form_title', f.definition.key), # This line is now safe
            "date": f.created_at.isoformat(),
            "data": f.data 
        })

    canvas_id = await _get_canvas_id(run_context.session_id, "VANIA_PATIENT_MANAGER")
    
    # 1. Always update the Forms List
    form_entries = await get_forms_history_sync(patient)
    forms_history = []
    for f in form_entries:
        forms_history.append({
            "id": str(f.id),
            "form_key": f.data.get('form_key'),
            "type": f.data.get('form_title', f.definition.key),
            "date": f.created_at.isoformat(),
            "data": f.data
        })
    
    updates = {
        "forms": forms_history
    }

    # 2. IF Base Profile was updated, refresh the Patient Profile Header
    if form_key == "BASE_PROFILE_V1":
        updates["patient_profile"] = {
            "id": patient.id,
            "name": actual_data.get("full_name") or patient.full_name,
            "phone": patient.phone_number,
            "age": actual_data.get("birth_date"),
            "job": f"{actual_data.get('job_status', '')} {actual_data.get('job_title', '')}",
            "education": actual_data.get("education_level"),
            "marital_status": actual_data.get("marital_status")
        }

    # 3. Emit Event
    yield CanvasUpdateEvent(value={
        "canvas_id": canvas_id,
        "component_key": "VANIA_PATIENT_MANAGER",
        "delta": updates
    })

    yield f"✅ Form submitted. Context updated."


@tool
async def manage_clinical_tests(
    run_context: RunContext,
    action: str,
    data: Dict[str, Any] = {}
) -> AsyncGenerator[Any, None]:
    """
    Manage psychology tests in the patient's tests panel.
    Actions:
    - ADD_TEST: data={catalog_id:int} or data={title:str, url:str}
    - UPDATE_SUMMARY: data={test_id:str, result_summary:str}
    - DELETE_TEST: data={test_id:str}
    """
    patient = await _get_active_patient()
    doctor = await CustomUser.objects.aget(pk=run_context.user_id)

    if not patient:
        yield "Error: No patient selected."
        return

    action_key = (action or "").upper()
    if action_key == "ADD_TEST":
        catalog_id = data.get("catalog_id")
        title = data.get("title")
        url = data.get("url")
        created = await sync_to_async(ClinicalTestsService.add_test)(
            patient=patient,
            created_by=doctor,
            catalog_id=int(catalog_id) if catalog_id else None,
            title=title,
            url=url,
        )
        msg = f"✅ Test added: {created.get('title')}"
    elif action_key == "UPDATE_SUMMARY":
        test_id = data.get("test_id")
        result_summary = data.get("result_summary", "")
        updated = await sync_to_async(ClinicalTestsService.update_test)(
            patient=patient,
            created_by=doctor,
            test_id=test_id,
            payload={"result_summary": result_summary},
        )
        if not updated:
            yield "❌ Test not found."
            return
        msg = "✅ Test summary updated."
    elif action_key == "DELETE_TEST":
        test_id = data.get("test_id")
        deleted = await sync_to_async(ClinicalTestsService.delete_test)(
            patient=patient,
            created_by=doctor,
            test_id=test_id,
        )
        if not deleted:
            yield "❌ Test not found."
            return
        msg = "✅ Test deleted."
    else:
        yield f"❌ Unknown action '{action}'."
        return

    tests_history = await sync_to_async(ClinicalTestsService.get_tests)(patient)
    canvas_id = await _get_canvas_id(run_context.session_id, "VANIA_PATIENT_MANAGER")
    yield CanvasUpdateEvent(value={
        "canvas_id": canvas_id,
        "component_key": "VANIA_PATIENT_MANAGER",
        "delta": {
            "tests": tests_history
        }
    })
    yield msg


@tool
async def update_forms_tests_analysis(
    run_context: RunContext,
    analysis_text: str
) -> AsyncGenerator[Any, None]:
    """
    Saves 'تحلیل بالینی تست ها و فرم ها' into the patient profile canvas.
    """
    patient = await _get_active_patient()
    if not patient:
        yield "Error: No patient selected."
        return

    await sync_to_async(ProfileService.update_forms_tests_analysis)(patient, analysis_text)
    canvas_id = await _get_canvas_id(run_context.session_id, "VANIA_PATIENT_MANAGER")
    yield CanvasUpdateEvent(value={
        "canvas_id": canvas_id,
        "component_key": "VANIA_PATIENT_MANAGER",
        "delta": {
            "forms_tests_analysis": analysis_text
        }
    })
    yield "✅ تحلیل بالینی تست‌ها و فرم‌ها ذخیره شد."


# ==========================================
# 8. TOOL FACTORY REGISTRATION
# ==========================================

@register_tool("vania_doctor")
class VaniaDoctorToolFactory(BaseCapability):
    """
    Provides the full suite of clinical tools for the Vania Doctor Agent,
    enabling the complete 6-Phase Protocol.
    """
    
    def get_tools(self, user, session_id) -> List[Any]:
        """
        Gathers and returns all necessary tools for the Vania Doctor agent.
        """
        return [
            # Phase 1: Profile & Analysis
            update_clinical_summary,
            
            # Phase 2/3: Strategy
            # NOTE: RAG search tool removed. Agent relies on internal knowledge.
            
            # Phase 4 & General Management
            manage_roadmap,
            
            # Phase 5: Execution
            finalize_session_report,
            add_rescue_task,
            
            # Phase 6: Appendix
            prescribe_resource,
            
            # General Clinical Utils
            get_form_schema,
            submit_clinical_form, # New automated form filling
            manage_clinical_tests,
            update_forms_tests_analysis,
        ]

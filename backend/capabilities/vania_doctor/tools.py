# backend/capabilities/vania_doctor/tools.py
import json
import logging
from typing import List, Optional, AsyncGenerator, Any, Dict
from django.utils import timezone
# --- Agno & Django Imports ---
from agno.tools import tool
from agno.run import RunContext
from asgiref.sync import sync_to_async

# --- Capability System Imports ---
from capabilities.base import BaseCapability
from capabilities.registry import register_tool
from canvas.events import CanvasUpdateEvent 

# --- Core Vania Models & Context ---
from agents.context import resource_context
from users.models import CustomUser
from vania_core.services import (
    RoadmapService, 
    AppendixService, 
    SessionService, 
    TaskService
)
from vania_core.schemas import TherapyPhase, SessionStatus

# Configure Logger for this module
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

async def _refresh_doctor_canvas(session_id: str, patient: CustomUser) -> AsyncGenerator[Any, None]:
    """
    Refreshes the 'VANIA_PATIENT_MANAGER' canvas with the latest data for all 4 pillars.
    This function yields a CanvasUpdateEvent, which is sent to the frontend to keep the UI
    in sync after a tool modifies the patient's state.
    """
    if not session_id or not patient:
        return

    # Asynchronously fetch fresh data for all data pillars
    roadmap = await sync_to_async(RoadmapService.get_or_create_roadmap)(patient)
    appendix = await sync_to_async(AppendixService.get_library)(patient)
    tasks = await sync_to_async(TaskService.get_patient_tasks)(patient)
    history = await sync_to_async(SessionService.get_patient_history)(patient, viewer_role='DOCTOR')
    
    # Yield the custom event that the frontend listens for
    yield CanvasUpdateEvent(value={
        "component_key": "VANIA_PATIENT_MANAGER",
        "delta": {
            "roadmap_data": roadmap.model_dump(),
            "appendix_data": appendix.model_dump(),
            "tasks": tasks,
            "sessions": history, # Legacy name, now holds structured reports
        }
    })

# ==========================================
# 2. PHASE 1: ANALYSIS TOOLS
# ==========================================

@tool
async def analyze_projective_tests(
    run_context: RunContext,
    file_ids: List[str] = [],
    observation_notes: str = ""
) -> AsyncGenerator[Any, None]:
    """
    [PHASE 1] Analyzes uploaded Projective Tests (Rorschach, TAT) or the doctor's clinical observations.
    Use this tool at the start of a new patient onboarding process to generate the initial psychological profile.
    
    Args:
        file_ids: List of file UUIDs uploaded by the doctor via the 'Clinical Assets' uploader.
        observation_notes: Descriptive notes from the doctor about the patient's behavior or test responses.
    """
    patient = await _get_active_patient()
    if not patient: 
        yield "Error: No patient is selected. Please select a patient before starting analysis."
        return

    # State Transition: Set the roadmap to Phase 1
    await sync_to_async(RoadmapService.update_phase)(patient, TherapyPhase.PHASE_1_ANALYSIS)
    
    # Refresh the UI to reflect the phase change
    async for evt in _refresh_doctor_canvas(run_context.session_id, patient):
        yield evt
    
    # Check for necessary input
    if not file_ids and not observation_notes:
        yield (
            "⚠️ **Phase 1 Alert**: No test files or observation notes were provided. "
            "I cannot proceed with the analysis. Please upload the patient's Rorschach/TAT files "
            "or provide detailed notes on their responses."
        )
        return

    # Acknowledge receipt; the actual analysis is performed by the LLM in the next turn
    # after receiving this confirmation message.
    msg = f"✅ **Phase 1 Initiated** for {patient.full_name}.\n"
    if file_ids:
        msg += f"Received {len(file_ids)} test files. "
    if observation_notes:
        msg += "Clinical observations have been noted. "
    
    msg += "I am now analyzing all provided data to generate the **Integrated Psychological Profile**..."
    
    yield msg

# ==========================================
# 3. PHASE 2/3: KNOWLEDGE & STRATEGY
# ==========================================

@tool
async def search_clinical_protocol(
    run_context: RunContext, 
    query: str
) -> AsyncGenerator[str, None]:
    """
    [PHASE 2/3] Searches the 'Vania Clinical Core' knowledge base for therapy approaches, techniques, and definitions.
    Use this to retrieve the list of 101 approaches or to get details on a specific method like CBT or Schema Therapy.
    """
    # This tool relies on the Agent's built-in RAG capability.
    # The 'knowledge' and 'search_knowledge=True' parameters configured in the ServiceAgent
    # factory automatically enable this functionality. The agent is trained to call this
    # when it needs to look up reference material from its seeded knowledge.
    
    # Access the agent instance from the run context
    agent = getattr(run_context, 'agent', None)
    if not agent or not hasattr(agent, 'knowledge') or not agent.knowledge:
        yield "Error: Knowledge Base is not configured for this agent."
        return

    # Perform the search
    try:
        search_results = await sync_to_async(agent.knowledge.search)(query=query, limit=5)
        
        if not search_results:
            yield f"No results found in the clinical protocol for '{query}'."
            return

        # Format results for the LLM
        formatted_output = "### Clinical Protocol Search Results:\n"
        for i, result in enumerate(search_results):
            formatted_output += f"[{i+1}] Source: {result.source_id}\nContent: {result.text}\n---\n"
        
        yield formatted_output

    except Exception as e:
        logger.error(f"RAG search failed: {e}")
        yield f"An error occurred while searching the knowledge base: {e}"


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
        title = data.get("title", "Untitled Session")
        instructions = data.get("instructions", "")
        await sync_to_async(RoadmapService.add_session)(patient, title, instructions)
        yield f"✅ Session '{title}' added to the roadmap."

    elif action.upper() == "UPDATE_STRATEGY":
        approaches = data.get("approaches", [])
        if approaches and isinstance(approaches, list):
            roadmap = await sync_to_async(RoadmapService.get_or_create_roadmap)(patient)
            roadmap.treatment_approaches = approaches
            await sync_to_async(RoadmapService.save_roadmap)(patient, roadmap)
            yield f"✅ Treatment strategy saved: {', '.join(approaches)}"
        else:
            yield "❌ Missing or invalid 'approaches' list in data payload."

    else:
        yield f"❌ Unknown action for manage_roadmap: '{action}'"

    # Always refresh the UI after any roadmap modification
    async for evt in _refresh_doctor_canvas(run_context.session_id, patient):
        yield evt


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
    
    # 4. Refresh the entire UI to reflect the changes
    async for evt in _refresh_doctor_canvas(run_context.session_id, patient):
        yield evt
        
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

    # Call the TaskService to create the task
    await sync_to_async(TaskService.assign_task)(
        patient=patient,
        doctor=doctor,
        text=text,
        due_date=due_date,
        dimension=dimension.upper() # Ensure consistency with Enum
    )
    
    # Refresh the canvas to show the new task in the Rescue Net tab
    async for evt in _refresh_doctor_canvas(run_context.session_id, patient):
        yield evt
        
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
    
    # Save the resource using the AppendixService
    await sync_to_async(AppendixService.add_resource)(patient, doctor, resource_data)
    
    # Refresh the UI to show the new card in the Appendix tab
    async for evt in _refresh_doctor_canvas(run_context.session_id, patient):
        yield evt
        
    yield f"✅ Prescribed {type}: '{title}' has been added to the Thought Appendix."


# ==========================================
# 7. TOOL FACTORY REGISTRATION
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
            # Phase 1
            analyze_projective_tests,
            
            # Phase 2/3
            search_clinical_protocol,
            
            # Phase 4 & General Management
            manage_roadmap,
            
            # Phase 5
            finalize_session_report,
            add_rescue_task,
            
            # Phase 6
            prescribe_resource,
        ]
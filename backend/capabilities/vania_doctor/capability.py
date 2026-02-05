# backend/capabilities/vania_doctor/capability.py
import logging
from typing import List, Any, Dict, Optional
from asgiref.sync import sync_to_async

# --- Capability System Imports ---
from capabilities.base import BaseCapability
from capabilities.registry import register_capability

# --- Vania Core & User Imports ---
from users.models import CustomUser
from vania_core.services import (
    RoadmapService, 
    AppendixService, 
    SessionService, 
    TaskService
)
from vania_core.schemas import TherapyPhase

# --- Form & Tooling Imports ---
from .form_definitions import ALL_FORMS_LIST

# Configure Logger
logger = logging.getLogger(__name__)

@register_capability("vania_doctor")
class VaniaDoctorCapability(BaseCapability):
    """
    Implements the 'Doctor' intelligence layer for the Vania Clinical Operating System.

    This capability is responsible for:
    1. Injecting the correct, phase-aware system prompt into the Agent's context.
    2. Providing the full suite of clinical tools required for the 6-Phase Protocol.
    3. Hydrating the 'PatientManagerCanvas' with the complete patient state on session start.
    """

    def get_tools(self, user: Any, session_id: str) -> List[Any]:
        """
        Provides the agent with the necessary tools to execute the clinical workflow.
        This method delegates to a dedicated Tool Factory for clean separation.
        """
        from .tools import VaniaDoctorToolFactory
        return VaniaDoctorToolFactory().get_tools(user, session_id)

    def get_context_prompt(self, user: Any, resource_id: str) -> str:
        """
        Dynamically generates the 'System Instructions' based on the Patient's exact phase in the 6-Phase Protocol.
        This is the core logic that makes the agent state-aware and procedural.
        """
        if not resource_id:
            return ""

        try:
            # Fetch the patient and their current therapy roadmap
            patient = CustomUser.objects.get(pk=resource_id)
            roadmap = RoadmapService.get_or_create_roadmap(patient)
            
            # --- Base Context (Included in every prompt) ---
            base_msg = f"""
### 🏥 ACTIVE CLINICAL CONTEXT
**Patient:** {patient.full_name} (ID: {patient.id})
**Current Phase:** {roadmap.current_phase.value}
**Guiding Doctor:** Dr. {user.full_name or user.phone_number}
"""

            # --- Phase-Specific Instructions ---

            # PHASE 1: Initial Analysis
            if roadmap.current_phase == TherapyPhase.PHASE_1_ANALYSIS:
                return base_msg + """
⚠️ **ACTION REQUIRED: PHASE 1 (ANALYSIS)**
The patient is in the initial analysis phase.
1.  **Goal:** Generate the "Integrated Psychological Profile".
2.  **Check:** Confirm if Projective Tests (TAT/Rorschach) have been provided.
3.  **Action:** If not, ask the doctor to upload them using the 'Clinical Assets' button. If yes, or if observations are provided, call `analyze_projective_tests`.
"""

            # PHASE 2 & 3: Strategy and Planning
            elif roadmap.current_phase == TherapyPhase.PHASE_2_APPROACHES:
                return base_msg + """
⚠️ **ACTION REQUIRED: PHASE 2 (APPROACH PROPOSAL)**
The profile is complete. You must now propose treatment approaches.
1.  **Action:** Use `search_clinical_protocol` to retrieve the master list of approaches.
2.  **Output:** Propose a list of 17 recommendations (10 Modern, 5 Hybrid, 2 Integrative) with rationales.
"""
            elif roadmap.current_phase == TherapyPhase.PHASE_4_PROTOCOL:
                return base_msg + """
⚠️ **ACTION REQUIRED: PHASE 4 (PROTOCOL DESIGN)**
The doctor has selected the approaches. You must now design the session protocols.
1.  **Action:** Generate a detailed, step-by-step execution guide for the upcoming sessions.
2.  **Tool:** Persist these plans by calling `manage_roadmap` with `action="ADD_SESSION"`.
"""

            # PHASE 5: Active Session Execution
            elif roadmap.current_phase == TherapyPhase.PHASE_5_EXECUTION:
                active_session = None
                if roadmap.active_session_number:
                    active_session = next((s for s in roadmap.sessions if s.session_number == roadmap.active_session_number), None)

                # If a specific session is "Active"
                if active_session:
                    return base_msg + f"""
⚡ **ACTION REQUIRED: EXECUTE SESSION {active_session.session_number}**
**Topic:** {active_session.title}
**Status:** ACTIVE / IN-PROGRESS

**CONFIDENTIAL PROTOCOL FOR DOCTOR:**
{active_session.doctor_instructions or "No specific protocol was generated. Proceed with standard clinical practice for this topic."}

**YOUR ROLE:**
1.  Guide the doctor through the protocol steps.
2.  When the doctor provides notes, use `finalize_session_report` to create the structured report.
"""
                # If no specific session is active, agent is in "idle" execution mode
                else:
                    return base_msg + """
✅ **PHASE 5: EXECUTION (IDLE)**
Therapy plan is active. You are awaiting the doctor to start a specific session from the Roadmap or provide notes on a completed one.
- **To Start:** The doctor must click "Start" on a planned session in the Canvas.
- **To Report:** Listen for the doctor's summary, then call `finalize_session_report`.
"""
            
            # Default fallback
            return base_msg

        except CustomUser.DoesNotExist:
            return "### SYSTEM ERROR: The selected patient ID was not found."
        except Exception as e:
            logger.error(f"Failed to generate context prompt for patient {resource_id}: {e}")
            return f"### SYSTEM ERROR: Could not load patient context. Details: {e}"

    def get_initial_canvas_state(
        self, 
        user: Any, 
        session_id: str, 
        resource_id: str,
        canvas_key: str
    ) -> Optional[Dict[str, Any]]:
        """
        Called by the Agent Factory during initialization to pre-load UI state (Auto-Hydration).
        This fetches all data for the 4 pillars (Roadmap, Rescue Net, Appendix, Forms).
        """
        # Ensure we only hydrate the canvas we own
        if canvas_key != "VANIA_PATIENT_MANAGER":
            return None

        if not resource_id:
            return None # No patient selected, return empty state

        try:
            patient = CustomUser.objects.get(pk=resource_id)
            
            # --- Fetch Data for All 4 Pillars ---
            
            # 1. Roadmap Data
            roadmap = RoadmapService.get_or_create_roadmap(patient)
            
            # 2. Rescue Net (Tasks) Data
            tasks = TaskService.get_patient_tasks(patient)
            
            # 3. Thought Appendix Data
            appendix = AppendixService.get_library(patient)
            
            # 4. Session History (for completed reports)
            history = SessionService.get_patient_history(patient, viewer_role='DOCTOR')

            # Assemble the final state object matching the frontend's PatientManagerState type
            return {
                "is_active": True,
                "patient_profile": {
                    "id": patient.id,
                    "name": patient.full_name or patient.phone_number,
                    "phone": patient.phone_number,
                },
                
                # --- Pass the 4 Data Pillars ---
                "roadmap_data": roadmap.model_dump(),
                "appendix_data": appendix.model_dump(),
                "tasks": tasks, 
                "sessions": history, # Legacy name, now holds structured reports

                # --- Form Data ---
                "forms": [], # Placeholder for completed form history
                "available_forms": ALL_FORMS_LIST, 
                
                # --- UI Control ---
                "active_tab": "ROADMAP", # Default to the roadmap on load
                "ui_signal": None
            }
        except Exception as e:
            logger.error(f"❌ [VaniaDoctorCapability] Hydration Failed for patient {resource_id}: {e}")
            return None # Return None to let the frontend show an error/empty state

    def get_default_canvases(self) -> List[str]:
        """
        Registers this capability as the owner of the 'VANIA_PATIENT_MANAGER' canvas.
        """
        return ["VANIA_PATIENT_MANAGER"]
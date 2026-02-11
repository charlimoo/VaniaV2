# backend/capabilities/vania_patient/capability.py
import logging
from typing import Dict, Any, List, Optional
from asgiref.sync import sync_to_async

from capabilities.base import BaseCapability
from capabilities.registry import register_capability
from vania_core.patient_service import PatientDataService
from vania_core.roadmap_service import RoadmapService
from vania_core.schemas import TherapyPhase
from users.models import CustomUser

logger = logging.getLogger(__name__)

@register_capability("vania_patient")
class VaniaPatientCapability(BaseCapability):
    """
    Implements the 'Patient' intelligence layer (Hamrah).
    This capability makes the agent aware of the clinical 6-Phase Protocol,
    injects phase-specific instructions, and handles the hydration of the
    Patient Journey dashboard.
    """
    
    def get_tools(self, user: Any, session_id: str) -> List:
        """
        Delegates tool creation to the factory to avoid circular imports and keep logic clean.
        """
        from .tools import VaniaPatientToolFactory
        return VaniaPatientToolFactory().get_tools(user, session_id)

    def get_system_prompt_additions(self, user: Any) -> str:
        """
        Injects dynamic, phase-aware context into the System Prompt.
        This guides the AI to behave differently depending on whether the patient
        is in the Analysis phase, Execution phase, etc.
        """
        try:
            # Fetch the roadmap to determine the current phase
            roadmap = RoadmapService.get_or_create_roadmap(user)
            phase = roadmap.current_phase
            
            base_prompt = f"""
### ROLE: Vania (Hamrah/همراه)
You are a supportive, non-judgmental therapeutic companion for {user.full_name or 'the patient'}.
You work in close coordination with their doctor's clinical treatment plan.
**Current Clinical Phase:** {phase}
"""

            # --- Phase-Specific Behavioral Adjustments ---
            
            if phase == TherapyPhase.PHASE_1_ANALYSIS:
                return base_prompt + """
**PHASE 1: ANALYSIS**
- **Context:** The doctor is currently analyzing projective tests and initial interviews.
- **Your Focus:** Reassure the patient. Explain that this phase is about deep understanding.
- **Action:** If they ask for advice, gently remind them that the comprehensive plan is being designed.
"""
            
            elif phase in [TherapyPhase.PHASE_2_APPROACHES, TherapyPhase.PHASE_3_SELECTION, TherapyPhase.PHASE_4_PROTOCOL]:
                return base_prompt + """
**PHASE 2-4: PLANNING & STRATEGY**
- **Context:** The doctor is designing the specific treatment protocol and selecting therapy approaches.
- **Your Focus:** Maintain engagement. Ask them how they are feeling about starting the journey.
"""

            elif phase == TherapyPhase.PHASE_5_EXECUTION:
                return base_prompt + """
**PHASE 5: EXECUTION (ACTIVE THERAPY)**
- **Context:** Sessions are ongoing. Tasks (Rescue Net) are assigned.
- **Your Focus:** Accountability and Reinforcement.
    1. Ask about the "Flashcards" from the last session.
    2. Encourage completion of "Rescue Net" tasks.
    3. Help them track their SMART goals.
"""
            
            elif phase == TherapyPhase.PHASE_6_APPENDIX:
                return base_prompt + """
**PHASE 6: THOUGHT APPENDIX & MAINTENANCE**
- **Context:** Focus on cultural enrichment and consolidating gains.
- **Your Focus:** Discuss the prescribed Books, Movies, or Poems.
    1. Ask reflective questions like "How did that character's journey resonate with you?"
    2. Encourage them to apply insights to daily life.
"""

            return base_prompt

        except Exception as e:
            logger.warning(f"Failed to inject patient prompt context: {e}")
            return "You are Vania, a supportive companion."

    def get_initial_canvas_state(
        self, 
        user: Any, 
        session_id: str, 
        resource_id: str,
        canvas_key: str
    ) -> Optional[Dict[str, Any]]:
        """
        Auto-Hydrates the 'Patient Journey' Canvas when the chat loads.
        Fetches aggregated data via PatientDataService.
        
        [FIX] This logic is now simplified. For the patient agent, the context
        is ALWAYS the authenticated user themselves. The 'resource_id' is ignored.
        """
        if canvas_key != "VANIA_PATIENT_JOURNEY":
            return None

        # The 'user' object here IS the patient. We don't need to look up a resource.
        target_patient = user
        
        try:
            # Use the dedicated service to get a sanitized, aggregated snapshot of the patient's data.
            # This service correctly queries all necessary tables (tasks, roadmap, logs, etc.)
            data = PatientDataService.get_patient_dashboard_snapshot(target_patient)

            # This payload directly matches the frontend's PatientState interface
            return {
                "is_active": True,
                "active_tab": "HOME",
                "greeting": data["greeting"],
                "current_phase": data["current_phase"],
                "tasks": data["tasks"],
                "timeline": data["timeline"],
                "library": data["library"],
                "active_goals": data["active_goals"],
                "my_doctors": data.get("my_doctors", []) 
            }
        except Exception as e:
            logger.error(f"❌ [VaniaPatientCapability] Failed to hydrate Patient Canvas for user {target_patient.id}: {e}", exc_info=True)
            # Return None to allow fallback to default empty state, preventing a crash.
            return None

    def get_default_canvases(self) -> List[str]:
        """
        Registers this capability as the owner of the Patient Journey UI.
        """
        return ["VANIA_PATIENT_JOURNEY"]
# backend/capabilities/vania_patient/capability.py
import logging
from typing import Dict, Any, List, Optional

from capabilities.base import BaseCapability
from capabilities.registry import register_capability
from vania_core.patient_service import PatientDataService
from vania_core.roadmap_service import RoadmapService
from vania_core.schemas import TherapyPhase
from users.models import CustomUser
from agents.context import selected_doctor_context
from vania_core.models import TreatmentConnection

logger = logging.getLogger(__name__)

@register_capability("vania_patient")
class VaniaPatientCapability(BaseCapability):
    """
    Implements the 'Patient' intelligence layer (Hamrah) and handles hydration
    of the Patient Journey dashboard.
    """
    
    @staticmethod
    def _resolve_selected_doctor_id(patient: Any) -> Optional[int]:
        raw = selected_doctor_context.get()
        logger.info(f"🧪 [VaniaPatientCapability] resolve doctor: ctx_raw={raw} patient={getattr(patient, 'id', None)}")
        if raw:
            try:
                selected = int(raw)
                has_access = TreatmentConnection.objects.filter(
                    patient=patient,
                    doctor_id=selected,
                    status=TreatmentConnection.Status.ACTIVE
                ).exists()
                logger.info(
                    f"🧪 [VaniaPatientCapability] ctx doctor candidate={selected} "
                    f"has_access={has_access}"
                )
                if has_access:
                    return selected
            except (TypeError, ValueError):
                logger.info("🧪 [VaniaPatientCapability] ctx doctor parse failed")
                pass
        conn = (
            TreatmentConnection.objects.filter(
                patient=patient,
                status=TreatmentConnection.Status.ACTIVE
            )
            .order_by("-updated_at")
            .first()
        )
        logger.info(f"🧪 [VaniaPatientCapability] fallback doctor={conn.doctor_id if conn else None}")
        return conn.doctor_id if conn else None

    def get_tools(self, user: Any, session_id: str) -> List:
        """
        Delegates tool creation to the factory to avoid circular imports and keep logic clean.
        """
        from .tools import VaniaPatientToolFactory
        return VaniaPatientToolFactory().get_tools(user, session_id)

    def get_system_prompt_additions(self, user: Any) -> str:
        """
        Injects dynamic, phase-aware context into the System Prompt.
        """
        try:
            doctor_id = self._resolve_selected_doctor_id(user)
            roadmap = RoadmapService.get_or_create_roadmap(user, doctor_id=doctor_id)
            phase = roadmap.current_phase
            
            base_prompt = f"""
### ROLE: Vania (Hamrah/همراه)
You are a supportive, non-judgmental therapeutic companion for {user.full_name or 'the patient'}.
You work in close coordination with their doctor's clinical treatment plan.
**Current Clinical Phase:** {phase}
**Roadmap Sessions Planned:** {len(roadmap.sessions)}
**Active Session Number:** {roadmap.active_session_number if roadmap.active_session_number is not None else "None"}
"""

            if phase == TherapyPhase.PHASE_1_ANALYSIS:
                return base_prompt + """
**PHASE 1: ANALYSIS**
- **Context:** The doctor is currently analyzing projective tests and initial interviews.
- **Your Focus:** Reassure the patient. Explain that this phase is about deep understanding.
- **Action:** If they ask for advice, gently remind them that the comprehensive plan is being designed.
"""
            
            if phase in [TherapyPhase.PHASE_2_APPROACHES, TherapyPhase.PHASE_3_SELECTION, TherapyPhase.PHASE_4_PROTOCOL]:
                return base_prompt + """
**PHASE 2-4: PLANNING & STRATEGY**
- **Context:** The doctor is designing the specific treatment protocol and selecting therapy approaches.
- **Your Focus:** Maintain engagement. Ask them how they are feeling about starting the journey.
"""

            if phase == TherapyPhase.PHASE_5_EXECUTION:
                return base_prompt + """
**PHASE 5: EXECUTION (ACTIVE THERAPY)**
- **Context:** Sessions are ongoing. Tasks (Rescue Net) are assigned.
- **Your Focus:** Accountability and Reinforcement.
1. Ask about the "Flashcards" from the last session.
2. Encourage completion of "Rescue Net" tasks.
3. Help them track their SMART goals.
"""
            
            if phase == TherapyPhase.PHASE_6_APPENDIX:
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
            doctor_id = self._resolve_selected_doctor_id(target_patient)
            logger.info(
                f"🧪 [VaniaPatientCapability] hydrate patient={target_patient.id} "
                f"resolved_doctor={doctor_id}"
            )
            data = PatientDataService.get_patient_dashboard_snapshot(target_patient, doctor_id=doctor_id)

            # This payload directly matches the frontend's PatientState interface
            return {
                "is_active": True,
                "active_tab": "HOME",
                "greeting": data["greeting"],
                "current_phase": data["current_phase"],
                "tasks": data["tasks"],
                "timeline": data["timeline"],
                "library": data["library"],
                "tests": data.get("tests", []),
                "active_goals": data["active_goals"],
                "forms_tests_analysis": data.get("forms_tests_analysis", ""),
                "my_doctors": data.get("my_doctors", []),
                "selected_doctor_id": data.get("selected_doctor_id")
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

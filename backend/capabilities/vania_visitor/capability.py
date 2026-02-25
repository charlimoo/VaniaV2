# backend/capabilities/vania_visitor/capability.py
import logging
from typing import Dict, Any, List, Optional

from capabilities.base import BaseCapability
from capabilities.registry import register_capability
from vania_core.patient_service import PatientDataService
from users.models import CustomUser
from agents.context import selected_doctor_context
from vania_core.models import TreatmentConnection

logger = logging.getLogger(__name__)


@register_capability("vania_visitor")
class VaniaVisitorCapability(BaseCapability):
    """
    Implements the visitor companion intelligence layer and handles hydration
    of the visitor journey dashboard.
    """

    @staticmethod
    def _resolve_selected_doctor_id(patient: Any) -> Optional[int]:
        raw = selected_doctor_context.get()
        logger.info(f"🧪 [VaniaVisitorCapability] resolve doctor: ctx_raw={raw} patient={getattr(patient, 'id', None)}")
        if raw:
            try:
                selected = int(raw)
                has_access = TreatmentConnection.objects.filter(
                    patient=patient,
                    doctor_id=selected,
                    status=TreatmentConnection.Status.ACTIVE
                ).exists()
                logger.info(
                    f"🧪 [VaniaVisitorCapability] ctx doctor candidate={selected} "
                    f"has_access={has_access}"
                )
                if has_access:
                    return selected
            except (TypeError, ValueError):
                logger.info("🧪 [VaniaVisitorCapability] ctx doctor parse failed")
                pass
        conn = (
            TreatmentConnection.objects.filter(
                patient=patient,
                status=TreatmentConnection.Status.ACTIVE
            )
            .order_by("-updated_at")
            .first()
        )
        logger.info(f"🧪 [VaniaVisitorCapability] fallback doctor={conn.doctor_id if conn else None}")
        return conn.doctor_id if conn else None

    def get_tools(self, user: Any, session_id: str) -> List:
        """
        Delegates tool creation to the factory to avoid circular imports and keep logic clean.
        """
        from .tools import VaniaVisitorToolFactory
        return VaniaVisitorToolFactory().get_tools(user, session_id)

    def get_system_prompt_additions(self, user: Any) -> str:
        """
        Capability-level companion policy for visitor workflows.
        Keeps process behavior reusable and separate from agent persona.
        """
        doctor_id = self._resolve_selected_doctor_id(user)
        return f"""
### VANIA VISITOR CAPABILITY: TOOL + CANVAS CONTRACT
You are operating with the visitor companion capability. This capability provides tool semantics and journey context, not domain flow rules.

#### General Rules
1. Use tools when reading or updating visitor state.
2. Treat phase/session fields as metadata only; do not infer mandatory flow from capability policy.
3. Keep communication supportive, clear, and non-judgmental.
4. Escalate crisis/safety risk to emergency services and the assigned expert.

#### Concept-to-Tool Mapping
- Status/journey snapshot: `load_my_journey`
- Task completion updates: `mark_task_complete`
- Resource completion updates: `mark_resource_consumed`
- Last-session reflection data: `reflect_on_session`

#### Context Metadata
- Active expert id (if resolved): {doctor_id if doctor_id is not None else "None"}
- Canvas key: `VANIA_PATIENT_JOURNEY`
"""

    def get_initial_canvas_state(
        self,
        user: Any,
        session_id: str,
        resource_id: str,
        canvas_key: str
    ) -> Optional[Dict[str, Any]]:
        """
        Auto-hydrates the journey canvas when the chat loads.
        For the visitor capability, the authenticated user is the target resource.
        """
        if canvas_key != "VANIA_PATIENT_JOURNEY":
            return None

        target_patient = user

        try:
            doctor_id = self._resolve_selected_doctor_id(target_patient)
            logger.info(
                f"🧪 [VaniaVisitorCapability] hydrate patient={target_patient.id} "
                f"resolved_doctor={doctor_id}"
            )
            data = PatientDataService.get_patient_dashboard_snapshot(target_patient, doctor_id=doctor_id)

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
            logger.error(f"❌ [VaniaVisitorCapability] Failed to hydrate Journey Canvas for user {target_patient.id}: {e}", exc_info=True)
            return None

    def get_default_canvases(self) -> List[str]:
        """
        Registers this capability as the owner of the Journey UI.
        """
        return ["VANIA_PATIENT_JOURNEY"]

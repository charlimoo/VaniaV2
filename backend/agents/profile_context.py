import json
from typing import Any, Dict, Optional

from agents.context import resource_context, selected_case_context, selected_doctor_context
from agents.storage import get_session_safe, get_storage
from users.models import CustomUser
from users.roles import has_visitor_features, is_expert
from vania_core.case_service import CaseService
from vania_core.profile_snapshots import (
    format_expert_profile_summary_from_payload,
    format_visitor_profile_summary_from_payload,
    get_expert_profile_payload,
    get_user_agent_profile_payload,
    get_visitor_base_profile_payload,
)


def _coerce_int(value: Any) -> Optional[int]:
    try:
        if value in (None, ""):
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def get_session_data_for_profile_context(user: Any, session_id: Optional[str], session_data: Optional[dict] = None) -> Dict[str, Any]:
    if isinstance(session_data, dict):
        return dict(session_data)
    if not session_id:
        return {}
    try:
        storage = get_storage()
        session = get_session_safe(storage, session_id, str(user.id))
        raw = getattr(session, "session_data", None) if session else None
        if not raw and isinstance(session, dict):
            raw = session.get("session_data")
        return dict(raw or {})
    except Exception:
        return {}


def _get_selected_case_for_patient(patient: CustomUser, session_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    cases = CaseService.get_accessible_cases_for_patient(patient)
    if not cases:
        return None

    selected_case_id = selected_case_context.get() or session_data.get("selected_case_id")
    if selected_case_id:
        match = next((item for item in cases if item.get("id") == selected_case_id), None)
        if match:
            return match

    selected_doctor_id = _coerce_int(selected_doctor_context.get())
    if selected_doctor_id is None:
        selected_doctor_id = _coerce_int(session_data.get("selected_expert_id") or session_data.get("selected_doctor_id"))
    if selected_doctor_id is not None:
        match = next((item for item in cases if _coerce_int(item.get("doctor_id")) == selected_doctor_id), None)
        if match:
            return match

    if len(cases) == 1:
        return cases[0]
    return None


def resolve_profile_context_entities(
    user: Any,
    session_id: Optional[str] = None,
    session_data: Optional[dict] = None,
) -> Dict[str, Any]:
    effective_session_data = get_session_data_for_profile_context(user, session_id, session_data)

    active_visitor = None
    active_expert = None

    active_visitor_id = _coerce_int(resource_context.get())
    if active_visitor_id is None:
        active_visitor_id = _coerce_int(effective_session_data.get("visitor_id") or effective_session_data.get("patient_id"))
    if active_visitor_id is not None and active_visitor_id != getattr(user, "id", None):
        active_visitor = CustomUser.objects.filter(pk=active_visitor_id).first()

    if is_expert(user):
        active_expert = user
    elif has_visitor_features(user):
        selected_case = _get_selected_case_for_patient(user, effective_session_data)
        active_expert_id = _coerce_int(
            (selected_case or {}).get("doctor_id")
            or selected_doctor_context.get()
            or effective_session_data.get("selected_expert_id")
            or effective_session_data.get("selected_doctor_id")
        )
        if active_expert_id is not None:
            active_expert = CustomUser.objects.filter(pk=active_expert_id).first()

    return {
        "session_data": effective_session_data,
        "active_visitor": active_visitor,
        "active_expert": active_expert,
    }


def build_default_profile_context(
    user: Any,
    session_id: Optional[str] = None,
    session_data: Optional[dict] = None,
) -> str:
    resolved = resolve_profile_context_entities(user, session_id=session_id, session_data=session_data)
    user_payload = get_user_agent_profile_payload(user)
    sections = []

    user_lines = []
    role_label = user_payload.get("role_label") or user_payload.get("role_slug")
    if user_payload.get("full_name"):
        user_lines.append(f"User Name: {user_payload['full_name']}")
    if role_label:
        user_lines.append(f"User Role: {role_label}")
    if user_payload.get("phone_number"):
        user_lines.append(f"User Phone: {user_payload['phone_number']}")
    if user_payload.get("email"):
        user_lines.append(f"User Email: {user_payload['email']}")
    user_lines.extend(
        format_expert_profile_summary_from_payload(
            user_payload.get("expert_profile") or {},
            label="User",
            include_identity=False,
        )
    )
    user_lines.extend(
        format_visitor_profile_summary_from_payload(
            user_payload.get("visitor_profile") or {},
            label="User",
            include_identity=False,
        )
    )
    if user_lines:
        sections.append("### USER PROFILE (System Injected)\n" + "\n".join([f"- {line}" for line in user_lines]))

    active_visitor = resolved.get("active_visitor")
    if active_visitor:
        visitor_payload = get_visitor_base_profile_payload(active_visitor)
        visitor_lines = format_visitor_profile_summary_from_payload(visitor_payload, label="Active Visitor")
        if visitor_lines:
            sections.append("### ACTIVE VISITOR PROFILE (System Injected)\n" + "\n".join([f"- {line}" for line in visitor_lines]))

    active_expert = resolved.get("active_expert")
    if active_expert and getattr(active_expert, "id", None) != getattr(user, "id", None):
        expert_payload = get_expert_profile_payload(active_expert) or {}
        expert_lines = format_expert_profile_summary_from_payload(expert_payload, label="Active Expert")
        if expert_lines:
            sections.append("### ACTIVE EXPERT PROFILE (System Injected)\n" + "\n".join([f"- {line}" for line in expert_lines]))

    if sections:
        sections.append(
            "### PROFILE TOOLS (System Injected)\n"
            "- Use `get_my_full_profile` for the full profile of the authenticated user.\n"
            "- Use `get_active_visitor_full_profile` for the scoped visitor when one is active.\n"
            "- Use `get_active_expert_full_profile` for the active expert profile in the current conversation."
        )

    return "\n\n".join(sections)


def serialize_profile_payload(payload: Dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2)

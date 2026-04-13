from typing import Any, AsyncGenerator, Dict, List

from agno.run import RunContext
from agno.tools import tool
from asgiref.sync import sync_to_async

from users.models import CustomUser
from vania_core.profile_snapshots import (
    get_expert_profile_payload,
    get_user_agent_profile_payload,
    get_visitor_base_profile_payload,
)

from .profile_context import resolve_profile_context_entities, serialize_profile_payload


async def _get_run_user(run_context: RunContext) -> CustomUser:
    return await CustomUser.objects.select_related("role", "expert_profession", "doctor_profile__location").aget(pk=run_context.user_id)


@tool
async def get_my_full_profile(run_context: RunContext) -> AsyncGenerator[Any, None]:
    user = await _get_run_user(run_context)
    payload = await sync_to_async(get_user_agent_profile_payload)(user)
    yield serialize_profile_payload(payload)


@tool
async def get_active_visitor_full_profile(run_context: RunContext) -> AsyncGenerator[Any, None]:
    user = await _get_run_user(run_context)
    resolved = await sync_to_async(resolve_profile_context_entities)(user, run_context.session_id)
    visitor = resolved.get("active_visitor")
    if not visitor:
        yield "No active visitor is selected in the current conversation."
        return
    payload: Dict[str, Any] = {
        "scope": "active_visitor",
        "viewer_user_id": int(user.id),
        "visitor_profile": await sync_to_async(get_visitor_base_profile_payload)(visitor),
    }
    yield serialize_profile_payload(payload)


@tool
async def get_active_expert_full_profile(run_context: RunContext) -> AsyncGenerator[Any, None]:
    user = await _get_run_user(run_context)
    resolved = await sync_to_async(resolve_profile_context_entities)(user, run_context.session_id)
    expert = resolved.get("active_expert")
    if not expert:
        yield "No active expert is selected in the current conversation."
        return
    payload: Dict[str, Any] = {
        "scope": "active_expert",
        "viewer_user_id": int(user.id),
        "expert_profile": await sync_to_async(get_expert_profile_payload)(expert),
    }
    if not payload["expert_profile"]:
        yield "Expert profile not found."
        return
    yield serialize_profile_payload(payload)


def get_global_profile_tools() -> List[Any]:
    return [
        get_my_full_profile,
        get_active_visitor_full_profile,
        get_active_expert_full_profile,
    ]

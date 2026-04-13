from __future__ import annotations

from typing import Optional

from users.models import CustomUser, UserContextEntry
from users.roles import has_visitor_features

from .case_service import CaseService


def sync_visitor_base_profile_identity(
    user: CustomUser,
    *,
    full_name: Optional[str] = None,
    email: Optional[str] = None,
) -> Optional[UserContextEntry]:
    """
    Keep visitor account identity fields mirrored into the shared base profile.
    """
    if not has_visitor_features(user):
        return None

    existing_entry = CaseService.get_latest_base_profile_entry(user)
    existing_data = existing_entry.data if existing_entry and isinstance(existing_entry.data, dict) else {}
    payload = {**existing_data}
    changed = False

    if full_name is not None:
        normalized_full_name = full_name.strip()
        if payload.get("full_name", "") != normalized_full_name:
            payload["full_name"] = normalized_full_name
            changed = True

    if email is not None:
        normalized_email = email.strip().lower()
        if payload.get("email", "") != normalized_email:
            payload["email"] = normalized_email
            changed = True

    if not changed:
        return existing_entry

    return CaseService.save_base_profile(
        user,
        payload,
        creator=user,
        source=UserContextEntry.SourceType.SYSTEM,
    )

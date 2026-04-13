from __future__ import annotations

from users.roles import CANONICAL_EXPERT_SLUG, CANONICAL_VISITOR_SLUG, normalize_role_slug


def _user_role_slug(user) -> str | None:
    role = getattr(user, "role", None)
    return normalize_role_slug(getattr(role, "slug", None))


def _user_profession_slug(user) -> str | None:
    profession = getattr(user, "expert_profession", None)
    return getattr(profession, "slug", None)


def _has_visitor_audience_access(role_slug: str | None) -> bool:
    return role_slug in {CANONICAL_VISITOR_SLUG, CANONICAL_EXPERT_SLUG}


def is_user_eligible_for_agent(user, agent) -> bool:
    audience = getattr(agent, "audience", "ALL")
    role_slug = _user_role_slug(user)

    if audience == "ALL":
        return True
    if audience == "VISITOR":
        return _has_visitor_audience_access(role_slug)
    if audience == "EXPERT":
        if role_slug != CANONICAL_EXPERT_SLUG:
            return False
        if not getattr(user, "is_expert_verified", False):
            return False
        eligible = list(getattr(agent, "eligible_expert_professions", []) or [])
        if not eligible:
            return True
        return (_user_profession_slug(user) or "") in eligible
    return False


def is_user_eligible_for_plan(user, plan) -> bool:
    audience = getattr(plan, "audience", "ALL")
    role_slug = _user_role_slug(user)

    if audience == "ALL":
        return True
    if audience == "VISITOR":
        return role_slug == CANONICAL_VISITOR_SLUG
    if audience == "EXPERT":
        if role_slug != CANONICAL_EXPERT_SLUG:
            return False
        if not getattr(user, "is_expert_verified", False):
            return False
        eligible = list(getattr(plan, "eligible_expert_professions", []) or [])
        if not eligible:
            return True
        return (_user_profession_slug(user) or "") in eligible
    return False

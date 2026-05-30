from typing import Optional

CANONICAL_EXPERT_SLUG = "expert"
CANONICAL_VISITOR_SLUG = "visitor"

ROLE_SLUG_ALIASES = {
    "doctor": CANONICAL_EXPERT_SLUG,
    "expert": CANONICAL_EXPERT_SLUG,
    "patient": CANONICAL_VISITOR_SLUG,
    "visitor": CANONICAL_VISITOR_SLUG,
}


def normalize_role_slug(slug: Optional[str]) -> Optional[str]:
    if not slug:
        return slug
    return ROLE_SLUG_ALIASES.get(slug, slug)


def is_staff_or_admin_user(user) -> bool:
    return bool(
        getattr(user, "is_authenticated", True)
        and (getattr(user, "is_staff", False) or getattr(user, "is_superuser", False))
    )


def is_expert(user) -> bool:
    if is_staff_or_admin_user(user):
        return True
    role = getattr(user, "role", None)
    slug = getattr(role, "slug", None)
    return normalize_role_slug(slug) == CANONICAL_EXPERT_SLUG


def is_visitor(user) -> bool:
    if is_staff_or_admin_user(user):
        return True
    role = getattr(user, "role", None)
    slug = getattr(role, "slug", None)
    return normalize_role_slug(slug) == CANONICAL_VISITOR_SLUG


def has_visitor_features(user) -> bool:
    """
    Visitor features are available to pure visitors and upgraded experts.
    """
    return is_visitor(user) or is_expert(user)

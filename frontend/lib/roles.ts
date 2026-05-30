export const CANONICAL_EXPERT_ROLE = "expert";
export const CANONICAL_VISITOR_ROLE = "visitor";

export const ROLE_SLUG_ALIASES: Record<string, string> = {
  doctor: CANONICAL_EXPERT_ROLE,
  expert: CANONICAL_EXPERT_ROLE,
  patient: CANONICAL_VISITOR_ROLE,
  visitor: CANONICAL_VISITOR_ROLE,
};

export function normalizeRoleSlug(roleSlug?: string | null): string | undefined {
  if (!roleSlug) return undefined;
  return ROLE_SLUG_ALIASES[roleSlug] || roleSlug;
}

export function isExpertRoleSlug(roleSlug?: string | null): boolean {
  return normalizeRoleSlug(roleSlug) === CANONICAL_EXPERT_ROLE;
}

export function isVisitorRoleSlug(roleSlug?: string | null): boolean {
  return normalizeRoleSlug(roleSlug) === CANONICAL_VISITOR_ROLE;
}

export function isStaffOrAdminUser(user?: { is_staff?: boolean | null; is_superuser?: boolean | null } | null): boolean {
  return Boolean(user?.is_staff || user?.is_superuser);
}

export function hasExpertFeatures(user?: { role_slug?: string | null; role?: string | null; is_staff?: boolean | null; is_superuser?: boolean | null } | null): boolean {
  return isStaffOrAdminUser(user) || isExpertRoleSlug(user?.role_slug) || isExpertRoleSlug(user?.role);
}

export function hasVisitorFeatures(user?: { role_slug?: string | null; role?: string | null; is_staff?: boolean | null; is_superuser?: boolean | null } | null): boolean {
  return isStaffOrAdminUser(user) || isVisitorRoleSlug(user?.role_slug) || isVisitorRoleSlug(user?.role) || hasExpertFeatures(user);
}

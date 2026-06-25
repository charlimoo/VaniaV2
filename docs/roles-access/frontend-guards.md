# Frontend Guards

Frontend guards improve navigation and presentation, but backend access remains authoritative.

## Key Paths

- `frontend/lib/roles.ts`
- `frontend/components/role-guard.tsx`
- `frontend/components/providers/user-provider.tsx`
- `frontend/app/(dashboard)/dashboard/layout.tsx`
- `frontend/app/(chat)/chat/layout.tsx`

## Role Helpers

`frontend/lib/roles.ts` mirrors backend normalization:

| Alias | Canonical role |
| --- | --- |
| `doctor` | `expert` |
| `expert` | `expert` |
| `patient` | `visitor` |
| `visitor` | `visitor` |

Use helpers instead of raw string comparisons:

- `normalizeRoleSlug`
- `isExpertRoleSlug`
- `isVisitorRoleSlug`
- `isStaffOrAdminUser`
- `hasExpertFeatures`
- `hasVisitorFeatures`

## RoleGuard

`RoleGuard`:

- waits for user loading
- normalizes allowed roles
- lets staff/admin users pass
- redirects mismatched users to `/dashboard`
- renders nothing while redirecting

Use it for route-level UX protection, not for security.

## User Provider

`UserProvider` loads `/api/auth/profile/`, exposes user/profile state, refreshes periodically, clears tokens on logout, and redirects unauthenticated users away from protected paths.

Role-sensitive components should consume the provider rather than refetching profile state independently.

## Service Metadata

Frontend agent cards and chat entry should use backend service metadata:

- `audience`
- `eligible_expert_professions`
- `requires_visitor_selector`
- `access_status`
- `demo_config`
- `input_requirements`

Do not recreate service eligibility rules in frontend-only code.

## Frontend Guard Rules

- Keep aliases compatible with backend.
- Staff/admin bypass is allowed for internal workflows.
- Use backend `access_status` and profile fields for UI states.
- Never assume hidden UI means blocked access.
- Keep product-facing access copy in Persian.

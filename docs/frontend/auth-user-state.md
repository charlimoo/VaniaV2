# Auth and User State

Frontend authentication state is loaded globally and consumed by dashboard, chat, role guards, API helpers, and page components.

## User Provider

Key file:

- `frontend/components/providers/user-provider.tsx`

`UserProvider` is mounted in the root layout. It:

- reads `accessToken` and `refreshToken` from `localStorage`
- fetches the current profile from `/api/auth/profile/`
- exposes loading, authentication, user, refresh, and logout state
- periodically refreshes profile/auth state
- redirects unauthenticated users away from protected paths

The current public path allowlist includes the root page plus public support, terms, and pitch-style pages.

## Token Storage

The browser stores JWT values in `localStorage`:

- `accessToken`
- `refreshToken`

Any code that changes token names must update `UserProvider`, `frontend/lib/api.ts`, AG-UI adapters, and attachment/session calls.

## Profile Loading

The profile request uses `NEXT_PUBLIC_API_URL` through `API_BASE_URL`. If no token is available, the provider treats the user as unauthenticated.

Profile state should be treated as the frontend cache of backend truth. Role-sensitive access must still be enforced by backend APIs.

## Logout

Logout clears stored tokens, resets provider state, and navigates to the root auth entry.

Avoid page-local logout implementations. Use the provider API so all auth state is cleared consistently.

## Role Guards

Key file:

- `frontend/components/role-guard.tsx`

`RoleGuard` uses `useUser`, `frontend/lib/roles.ts`, and staff/admin helpers to protect role-specific UI surfaces. It can redirect mismatched users to `/dashboard`.

Role guards are UX helpers. Backend endpoints must still enforce the corresponding permissions.

## Role Normalization

Key file:

- `frontend/lib/roles.ts`

Known aliases:

| Input | Normalized role |
| --- | --- |
| `doctor` | `expert` |
| `expert` | `expert` |
| `patient` | `visitor` |
| `visitor` | `visitor` |

Use the shared helpers for role checks:

- `normalizeRoleSlug`
- `isExpertRoleSlug`
- `isVisitorRoleSlug`
- `isStaffOrAdminUser`
- `hasExpertFeatures`
- `hasVisitorFeatures`

## Auth Change Checklist

When changing auth behavior, verify:

- public routes still load without a token
- dashboard routes redirect unauthenticated users
- chat routes redirect unauthenticated users
- refresh behavior does not loop
- logout clears all stored auth state
- visitor, expert, staff, and admin role checks still match backend behavior

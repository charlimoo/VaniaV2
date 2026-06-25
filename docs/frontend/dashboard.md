# Dashboard

The dashboard contains authenticated product workflows outside the chat workspace.

## Key Files

- `frontend/app/(dashboard)/dashboard/layout.tsx`
- `frontend/app/(dashboard)/dashboard/page.tsx`
- `frontend/components/dashboard`
- `frontend/components/sidebar`
- `frontend/components/global-header`
- `frontend/components/billing`
- `frontend/components/settings`
- `frontend/lib/api.ts`
- `frontend/lib/roles.ts`

## Layout

`dashboard/layout.tsx` creates the authenticated dashboard shell:

- `SidebarProvider` controls dashboard sidebar state.
- `DashboardSidebar` renders the main product navigation.
- `GlobalHeader` renders the dashboard header.
- The main content area applies the shared dashboard spacing and responsive constraints.

The layout expects an authenticated user. `UserProvider` and dashboard layout redirect behavior should stay consistent when auth paths change.

## Routes

| Route | Purpose |
| --- | --- |
| `/dashboard` | Dashboard home, service discovery, product overview, recent state |
| `/dashboard/billing` | Plans, credits, subscription/payment entry points |
| `/dashboard/doctors` | Visitor-facing expert/doctor relationships |
| `/dashboard/doctors/find` | Visitor flow for finding experts |
| `/dashboard/experts` | Expert discovery or management flow where enabled |
| `/dashboard/experts/find` | Expert search/selection flow where enabled |
| `/dashboard/faq` | Authenticated help content |
| `/dashboard/invoices` | Invoice list |
| `/dashboard/invoices/[id]` | Invoice detail |
| `/dashboard/journey` | Journey/case-related product surface |
| `/dashboard/messages` | Message overview |
| `/dashboard/patients` | Expert-facing patient/visitor management |
| `/dashboard/settings` | Account, profile, and role-specific settings |
| `/dashboard/tests` | Test-related dashboard surface |
| `/dashboard/visitors` | Expert-facing visitor list or management flow |

Route ownership can overlap by role. Check the page implementation and backend APIs before assuming a route is visitor-only or expert-only.

## Role Behavior

Dashboard rendering must match backend access and eligibility rules:

- Visitors and experts see different navigation and workflows.
- Experts may have profession-specific forms and capabilities.
- Staff/admin users can have broader access than normal users.
- Frontend hiding is never sufficient for access control.

Use `frontend/lib/roles.ts` helpers instead of duplicating role alias logic in page components.

## Common API Dependencies

Dashboard pages commonly call:

- `/api/auth/profile/`
- `/api/services/`
- `/api/billing/`
- `/api/vania/`
- `/agent/sessions`

Use shared API helpers from `frontend/lib/api.ts` when possible so auth headers and error handling remain consistent.

## Rules

- Dashboard visibility should match backend access rules.
- Product UI copy should remain Persian unless there is a clear reason otherwise.
- Expert profession differences must be reflected in UI flows.
- Dashboard routes should not bypass backend checks by relying only on client-side role guards.
- Dashboard changes should be checked with at least one visitor account and one expert account when the feature is role-sensitive.

## Manual Checks

When changing dashboard pages, verify:

- unauthenticated redirect
- sidebar active state
- mobile sidebar behavior
- role-specific navigation
- billing and access state presentation
- Persian UI copy and RTL layout

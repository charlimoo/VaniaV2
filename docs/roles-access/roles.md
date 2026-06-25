# Roles

Vania has two main user roles:

- `visitor`
- `expert`

The code also preserves legacy aliases:

| Alias | Canonical role |
| --- | --- |
| `patient` | `visitor` |
| `visitor` | `visitor` |
| `doctor` | `expert` |
| `expert` | `expert` |

Always normalize role slugs before comparing them.

## Key Paths

- `backend/users/roles.py`
- `backend/users/eligibility.py`
- `frontend/lib/roles.ts`
- `frontend/components/role-guard.tsx`

## Role Semantics

Visitors are the people receiving services, managing their shared base profile, opening their own cases, and using visitor-facing agents and canvas.

Experts are verified professional users who can manage accessible visitors, cases, expert canvases, case files, forms, tests, medications, roadmaps, and other profession-scoped workflows.

Staff and superusers bypass normal role gates for internal/admin workflows. Treat that as an explicit privileged path, not a normal product role.

## Expert Professions

Current synced profession slugs are:

- `psychologist`
- `psychiatrist`
- `lawyer`
- `general_doctor`

Profession affects agent eligibility, plan eligibility, visible tabs, available forms/tests, capability tool families, prompt policy, and case-sharing candidates.

## Affected Behavior

- Agent visibility
- Dashboard routes
- Profile and settings forms
- Subscription plan eligibility
- Expert-specific capabilities
- Visitor-selection flows
- Canvas tabs and write controls
- Case/resource access
- Tool availability

## Helper Behavior

Backend helpers:

- `normalize_role_slug`
- `is_staff_or_admin_user`
- `is_expert`
- `is_visitor`
- `has_visitor_features`

Frontend helpers:

- `normalizeRoleSlug`
- `isExpertRoleSlug`
- `isVisitorRoleSlug`
- `isStaffOrAdminUser`
- `hasExpertFeatures`
- `hasVisitorFeatures`

Important nuance: backend `is_expert()` and `is_visitor()` both return `True` for staff/admin users. `has_visitor_features()` returns `True` for visitors and experts because upgraded experts can use visitor-facing features.

## Rules

- Do not assume all experts are interchangeable.
- Do not compare raw role slugs without normalization.
- Do not rely on frontend hiding for security.
- Keep legacy `doctor/patient` aliases compatible until all callers are migrated.
- Keep product-facing role labels in Persian.

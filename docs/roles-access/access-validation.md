# Access Validation

Access changes should be validated across discovery, runtime, billing, canvas/resource APIs, and frontend guards.

## Backend Checks

Run relevant tests from `backend/`:

```bash
pytest
```

Also run definition sync when changing role, profession, agent, or plan definitions:

```bash
python manage.py sync
```

## Frontend Checks

Run from `frontend/` for UI/guard changes:

```bash
pnpm exec tsc --noEmit
```

## Docs Check

Run from `docs/`:

```bash
pnpm build
```

## Manual Matrix

Check these personas:

- unauthenticated user
- visitor
- unverified expert applicant
- verified psychologist
- verified psychiatrist
- verified lawyer
- verified general doctor
- wrong-profession expert
- staff/admin

## Service Access Scenarios

For each relevant persona, verify:

- `/api/services/` returns expected agents
- locked/free/owned status is correct
- expert-only agents are hidden from unverified users
- profession-specific agents are hidden from wrong professions
- runtime `/agent/agui` rejects ineligible users
- demo behavior works for locked but demo-allowed agents

## Billing Scenarios

Verify:

- product list filters plans by audience/profession
- direct purchase rejects ineligible plans
- paid invoice fulfillment rechecks eligibility
- active plan unlocks included agents
- access cache updates after plan activation
- free users cannot spend top-up balance without an active plan

## Resource Scenarios

Verify:

- expert can browse active visitors
- expert owner can edit own case
- read-only shared expert can view but not mutate
- visitor can view own cases
- base profile is shared correctly
- non-base forms/tests stay case/viewer scoped
- canvas PATCH rejects forbidden case edits

## Common Failures

| Symptom | Check |
| --- | --- |
| Agent missing | `is_public`, `is_active`, audience, profession, verification, sync. |
| Agent visible but cannot run | runtime `AccessControlService`, wallet plan, plan inclusion. |
| Expert plan not visible | role is not canonical expert, `is_expert_verified=False`, profession mismatch. |
| Wrong tools available | profession policy and tool family mapping. |
| Read-only expert can edit | backend case edit check and canvas PATCH path. |
| Frontend route loops | `UserProvider`, `RoleGuard`, normalized role fields. |

## Completion Checklist

Before finishing access work:

- backend access is enforced
- frontend guard is only presentation
- aliases remain compatible
- staff/admin path is explicit
- role/profession/billing/resource tests or manual checks are covered
- docs mention any changed access contract

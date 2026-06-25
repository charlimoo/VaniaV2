# Context Propagation

Context propagation keeps chat, canvas, tools, and domain APIs scoped to the same active visitor, expert, and case.

## Supported Context Names

The codebase intentionally supports old and new naming conventions.

| Concept | Current name | Legacy/alias name |
| --- | --- | --- |
| Visitor resource | `visitorId` | `patientId` |
| Expert resource | `expertId` | `doctorId` |
| Case | `caseId` | none |

Backend headers:

- `X-Target-Resource-ID`
- `X-Target-Visitor-ID`
- `X-Target-Patient-ID`
- `X-Target-Expert-ID`
- `X-Target-Doctor-ID`
- `X-Target-Case-ID`
- `X-Active-Role`

## Frontend Sources

The chat route reads context from query params, canvas store state, selected patient/case UI, and restored session state.

Important files:

- `frontend/app/(chat)/chat/[agentId]/[threadId]/page.tsx`
- `frontend/lib/canvas/useCanvasSync.ts`
- `frontend/lib/canvas/store.ts`
- `frontend/lib/SimpleThreadAdapters.ts`

## FastAPI Context

FastAPI middleware reads headers into context variables:

- `user_context`
- `role_context`
- `resource_context`
- `selected_doctor_context`
- `selected_case_context`

Important files:

- `backend/agents/middleware.py`
- `backend/agents/context.py`

These context vars are consumed by:

- Agent factory prompt/context assembly.
- Capability context hooks.
- Canvas hydration.
- Canvas instance PATCH persistence.
- Tools that need the active resource or case.

## Django Context

Django domain views commonly read scoped context directly from headers and query parameters. There is also a helper middleware file for extracting Vania context:

- `backend/vania_core/middleware.py`

In the current settings file, this middleware is not listed in `MIDDLEWARE`, so do not assume it is active unless the settings are updated. When documenting or changing `/api/vania/...` endpoints, inspect the view code for how it reads `X-Target-*` headers.

## Session State Aliases

Agent sessions normalize aliases so both naming conventions remain usable:

- `visitor_id` and `patient_id`
- `selected_expert_id` and `selected_doctor_id`
- `visitor_name` and `patient_name`
- `selected_expert_name` and `selected_doctor_name`
- `selected_case_title`, `case_title`, and `case_name`

Important file:

- `backend/agents/routes.py`

## Rules

- Preserve both alias families unless a coordinated migration updates backend, frontend, sessions, URLs, and docs together.
- When adding scoped API calls, send both expert and doctor headers if the code path still supports both.
- Context headers are not access control by themselves. The backend must still verify user, role, profession, and resource permissions.
- When context changes, canvas hydration may need to re-run because session-level canvas state can become stale.

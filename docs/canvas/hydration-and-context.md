# Hydration and Context

Canvas hydration builds session canvas state from the active agent, active capabilities, authenticated user, selected resource, selected expert/doctor, and selected case.

## Endpoint

```text
GET /agent/canvas/state/{session_id}
```

Important query params:

- `agent_id`
- `visitor_id`
- `patient_id`
- `expert_id`
- `doctor_id`
- `case_id`

Important headers:

- `X-Target-Resource-ID`
- `X-Target-Expert-ID`
- `X-Target-Doctor-ID`
- `X-Target-Case-ID`

The endpoint normalizes visitor/patient and expert/doctor aliases.

## Capability Hydration

`perform_hydration(...)`:

1. Sets selected doctor/case context variables.
2. Loads `AgentService` by slug.
3. Reads active capability domains from `service.capabilities`.
4. Gets target canvas keys from `CapabilityRegistry.get_canvases_for_domains`.
5. Loads each `CanvasType`.
6. Calls `CapabilityRegistry.get_initial_state_for_domains`.
7. Falls back to `CanvasType.default_state`.
8. Updates or creates a `CanvasInstance`.

## Expert Canvas Hydration

`vania_expert` hydrates `VANIA_PATIENT_MANAGER`.

It uses:

- selected visitor/patient resource ID
- selected case context
- expert profession policy
- accessible cases for the expert
- shared base profile
- case summary, roadmap, tasks, appendix, medications, sessions, forms, tests, and files

If no visitor is active, the default state is inactive and the renderer shows visitor selection.

## Visitor Canvas Hydration

`vania_visitor` hydrates `VANIA_PATIENT_JOURNEY`.

It uses:

- authenticated visitor user
- selected case context when available
- selected doctor/expert context when available
- shared base profile
- accessible cases
- active case snapshot
- visible forms/tests/files
- profession policy derived from the active case expert

Visitor hydration can work without an explicit resource ID because the visitor is the authenticated user.

## Staleness Detection

The state endpoint can force rehydration when existing canvas state is stale.

Patient manager rehydrates when:

- state is inactive/empty
- scoped case ID differs from `selected_case_id`
- selected case payload is missing or for another case
- shared base profile differs from canonical persisted base profile

Patient journey rehydrates when:

- state is inactive
- case list is empty
- scoped doctor ID differs from `selected_doctor_id`
- scoped case ID differs from `selected_case_id`
- selected case payload is missing or for another case

## Context Rules

- Preserve visitor/patient and expert/doctor aliases.
- Keep URL query params, request headers, session state, and canvas store context aligned.
- Do not expose resource data from hydration unless the authenticated user can access it.
- A case switch should update both selected case and selected doctor when the case carries doctor ownership.

# Backend Canvas

Backend canvas behavior is registered through capabilities, synced into service/canvas models, hydrated by the runtime, updated by tools and frontend PATCH requests, and persisted in `CanvasInstance` rows.

## Key Paths

- `backend/capabilities/*/canvas.py`
- `backend/capabilities/*/capability.py`
- `backend/capabilities/registry.py`
- `backend/canvas/routes.py`
- `backend/canvas/manager.py`
- `backend/canvas/events.py`
- `backend/services/models_canvas.py`
- `backend/definitions/sync.py`
- `backend/agents/factory.py`

## Responsibilities

- Register canvas types
- Provide initial state for resource contexts
- Persist canvas instances
- Merge runtime/user deltas safely
- Bridge selected visitor/expert/case context into hydration
- Persist permanent domain changes when a canvas edit represents durable business data
- Support runtime hydration and updates

## Canvas Definitions

Canvas classes inherit from `BaseCanvas` and are registered with `@register_canvas`.

Current classes:

| File | Class | Component key |
| --- | --- | --- |
| `backend/capabilities/vania_expert/canvas.py` | `PatientManagerCanvas` | `VANIA_PATIENT_MANAGER` |
| `backend/capabilities/vania_visitor/canvas.py` | `PatientJourneyCanvas` | `VANIA_PATIENT_JOURNEY` |

`CapabilityRegistry.sync_to_db()` writes registered canvas metadata to `CanvasType`.

## Runtime Hydration

Hydration can happen from two backend paths:

- `backend/agents/factory.py` when an agent runtime is created.
- `GET /agent/canvas/state/{session_id}` when the frontend loads or context changes.

Both paths ask active capability domains for default canvas keys and initial state.

## State Endpoint

`GET /agent/canvas/state/{session_id}` returns:

```json
{
  "session_id": "...",
  "canvases": [
    {
      "id": "...",
      "name": "...",
      "slug": "...",
      "component_key": "...",
      "current_state": {},
      "is_visible": true
    }
  ]
}
```

It accepts `agent_id` plus visitor/patient, expert/doctor, and case context through query params and headers.

## Update Endpoint

`PATCH /agent/canvas/instance/{instance_id}` accepts:

```json
{
  "delta": {}
}
```

The route:

1. Resolves context from FastAPI context variables.
2. Persists permanent Vania data when known keys are present.
3. Calls `canvas_manager.update_canvas_state(..., operation="merge")`.
4. Returns the merged state.

## Manager Merge Rules

`canvas_manager.update_canvas_state()` locks the row with `select_for_update`, retries database lock conflicts, and deep-merges deltas.

Arrays are overwritten. This is intentional to avoid infinite growth from repeated re-render/update cycles.

## Event Emission

Tools use `CanvasUpdateEvent` for agent-originated updates. The AG-UI stream wraps it as a custom event and the frontend consumes it through `useCanvasSync`.

## Backend Rules

- Capability hydration must enforce resource access before exposing data.
- Read-only shared cases must reject expert edits.
- Backend update routes must not rely on frontend locking for security.
- If state is permanent product data, persist it in the proper Vania service/model, not only in canvas JSON.
- Canvas hydration should log failures and avoid taking down chat when existing state can still render.

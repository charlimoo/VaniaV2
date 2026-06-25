# Canvas Backend

The backend canvas system stores canvas types, agent canvas support, and per-session canvas state. It also hydrates canvas state from capabilities and persists user edits.

## Key Files

| File | Purpose |
| --- | --- |
| `backend/services/models_canvas.py` | `CanvasType`, `AgentCanvasConfig`, `CanvasInstance` |
| `backend/canvas/routes.py` | FastAPI canvas hydration and update routes |
| `backend/canvas/manager.py` | Transactional state merge and persistence |
| `backend/canvas/events.py` | `CanvasUpdateEvent` custom AG-UI event |
| `backend/capabilities/*/canvas.py` | Canvas type registration |
| `backend/capabilities/*/capability.py` | Initial canvas state providers |

## Models

### CanvasType

Defines a canvas class. `component_key` is the backend/frontend compatibility key.

### AgentCanvasConfig

Connects an `AgentService` to a `CanvasType` and stores default-open and permission metadata.

### CanvasInstance

Stores live JSON canvas state for a specific session id.

## Hydration Endpoint

`GET /agent/canvas/state/{session_id}`

Query params:

- `agent_id`
- `patient_id`
- `visitor_id`
- `doctor_id`
- `expert_id`
- `case_id`

Headers:

- `X-Target-Resource-ID`
- `X-Target-Expert-ID`
- `X-Target-Doctor-ID`
- `X-Target-Case-ID`

Hydration flow:

1. Fetch existing `CanvasInstance` rows by session id.
2. Detect missing or stale state.
3. Resolve active capability canvas keys for `agent_id`.
4. Ask capabilities for initial state.
5. Update or create `CanvasInstance` rows.
6. Return canvas DTOs to frontend.

## Update Endpoint

`PATCH /agent/canvas/instance/{instance_id}`

Body:

```json
{
  "delta": {}
}
```

The route:

- Loads the canvas instance.
- Reads scoped patient, expert, and case context.
- Persists durable domain changes when relevant keys are present.
- Calls `canvas_manager.update_canvas_state(..., operation="merge")`.

## Merge Semantics

`CanvasManager.deep_merge`:

- Recursively merges dictionaries.
- Overwrites arrays.
- Overwrites primitives.

Database updates use `select_for_update` with retry handling for lock contention.

## Durable Persistence Hooks

Canvas PATCH may also persist:

- case lists
- clinical summaries
- base profile
- patient demographics
- forms/tests analysis
- medication plans

These writes go through `CaseService`, `ProfileService`, and `MedicationService`.

## Agent-Originated Updates

Capability tools can yield:

```python
CanvasUpdateEvent(value={"canvas_id": "...", "delta": {...}})
```

The stream generator emits this as AG-UI `CUSTOM` event `CANVAS_UPDATE`.

## Backend Rules

- Do not treat `CanvasInstance.current_state` as the only durable record for clinical/domain data.
- Always preserve `component_key` compatibility.
- Hydration should be idempotent.
- Canvas update failures should not pretend persistence succeeded.
- Context headers must be sent for scoped patient/case writes.

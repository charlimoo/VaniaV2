# Canvas Contract

Canvas is the structured collaboration surface used beside chat. It is not a decorative panel; it is a persisted, role-aware workspace where humans and agents collaborate on structured case/profile data.

The canvas contract spans backend definitions, database state, runtime events, frontend stores, and renderer modules.

## Cross-Layer Contract

A canvas must align across:

- Backend capability registration
- Synced database canvas type
- Agent canvas configuration
- Runtime hydration
- Context headers and query params
- Frontend renderer resolution
- Zustand store/sync behavior
- AG-UI custom events
- Persistent domain services when user edits should survive beyond one session

## Primary Compatibility Field

`component_key` is the compatibility bridge between backend canvas definitions and frontend renderer modules.

Current canonical keys:

| Key | Backend class | Frontend renderer | Audience |
| --- | --- | --- | --- |
| `VANIA_PATIENT_MANAGER` | `PatientManagerCanvas` | `PatientManagerCanvas.tsx` | Expert |
| `VANIA_PATIENT_JOURNEY` | `PatientJourneyCanvas` | `PatientJourneyCanvas.tsx` | Visitor |

Do not rename these keys without a migration plan.

## Data Contract

Canvas state is JSON. The top-level payload should be an object. Updates are partial object deltas.

Merge rules:

- dictionaries are deep-merged
- arrays are overwritten
- primitives are overwritten
- non-object payloads are invalid for backend updates

This rule exists on both sides:

- backend: `backend/canvas/manager.py`
- frontend: `frontend/lib/canvas/store.ts`

## Renderer Contract

`CanvasRegistry` passes this shape to renderers:

```ts
{
  canvasId?: string;
  data: any;
  onEdit: (delta: Record<string, any>) => void;
  isLocked: boolean;
}
```

Renderers must render from `data`, call `onEdit` for user changes, and respect `isLocked` plus case-level read-only flags.

## Runtime Event Contract

Tools update canvas through `CanvasUpdateEvent`, emitted as an AG-UI custom event:

```json
{
  "name": "CANVAS_UPDATE",
  "value": {
    "canvas_id": "...",
    "component_key": "VANIA_PATIENT_MANAGER",
    "delta": {},
    "force_open": true,
    "meta": {}
  }
}
```

`canvas_id` and `delta` are the required fields consumed by the frontend. `component_key`, `force_open`, and `meta` support self-healing/new-instance behavior.

## Persistence Boundary

Canvas JSON is session state. Some user edits also update permanent domain data in `backend/canvas/routes.py`, including:

- shared base profile
- patient demographics
- case list
- clinical summary
- forms/tests analysis
- medication plan

If a new renderer edits permanent business data, add the backend persistence hook. Do not assume saving `CanvasInstance.current_state` is enough.

## Rules

- Preserve existing `component_key` values unless there is a migration plan.
- Check demo modes: visible, hidden, or locked.
- Validate both mobile and desktop behavior.
- Keep renderer props compatible with persisted canvas state.
- Keep backend state shape aligned with TypeScript types in `frontend/lib/types/vania.ts`.
- Keep product-facing canvas copy in Persian and RTL.
- Keep docs and contributor notes in English.

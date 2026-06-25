# Canvas Lifecycle

Canvas moves through definition, sync, hydration, rendering, updates, and rehydration. A bug in any layer can make the canvas disappear, show stale case data, or update only the session JSON without updating permanent domain state.

## Lifecycle Overview

```text
BaseCanvas class
  -> @register_canvas
  -> CapabilityRegistry.autodiscover()
  -> CapabilityRegistry.sync_to_db()
  -> CanvasType
  -> AgentDef.default_open_canvases / capability get_default_canvases()
  -> AgentCanvasConfig + runtime target keys
  -> CanvasInstance
  -> GET /agent/canvas/state/{session_id}
  -> CanvasPanel / CanvasRegistry
  -> renderer onEdit or CanvasUpdateEvent
  -> CanvasInstance merge + domain persistence
```

## Definition Stage

Canvas metadata starts in `backend/capabilities/*/canvas.py`:

- `component_key`
- `name`
- `slug`
- `description`
- `get_default_state()`
- `get_schema()`

This is the source of truth for canvas type metadata.

## Sync Stage

`python manage.py sync` autodiscovers capability modules and syncs registered canvases to `CanvasType`.

Agent definitions also associate default canvas keys with `AgentCanvasConfig` through `DefinitionSync.sync_agents()`.

## Hydration Stage

Hydration creates or updates `CanvasInstance` rows for a session. It asks active capabilities for initial state.

Hydration is context-aware. Selected visitor/patient, expert/doctor, and case context can change which state is returned.

## Render Stage

The frontend loads state through `useCanvasSync`, stores instances in `useCanvasStore`, opens `CanvasPanel`, and resolves renderer modules through `CanvasRegistry`.

Renderers should never assume a canvas exists until hydration has returned instances.

## Update Stage

User updates call `onEdit`, which deep-merges local state and fires a background PATCH. Agent updates arrive through AG-UI `CANVAS_UPDATE` custom events.

The backend merge operation writes `CanvasInstance.current_state`. For known permanent fields, `backend/canvas/routes.py` also writes domain data before merging canvas JSON.

## Rehydration Stage

`GET /agent/canvas/state/{session_id}` may rehydrate when:

- no canvas instances exist
- patient manager state is inactive or empty
- selected case scope changes
- selected case payload is stale
- shared base profile differs from canonical persisted profile
- patient journey has no cases or is inactive
- doctor/case scope changes for patient journey

This prevents long-lived sessions from showing stale resource context.

## Lifecycle Checklist

When adding or changing canvas behavior:

- update backend canvas definition
- update capability default canvas and initial state hooks
- run sync
- update frontend renderer/type contract
- verify hydration on fresh and existing sessions
- verify user PATCH and agent event paths
- verify rehydration after switching case/resource context

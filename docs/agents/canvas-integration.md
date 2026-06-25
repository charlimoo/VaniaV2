# Canvas Integration

Agents and capabilities connect to canvas through code-defined canvas classes, default canvas keys, synced database rows, runtime hydration, AG-UI canvas update events, and frontend renderer resolution.

## Backend Pieces

| Piece | Purpose |
| --- | --- |
| `BaseCanvas` | Defines canvas metadata, default state, and schema. |
| `@register_canvas` | Registers a canvas by `component_key`. |
| `CapabilityRegistry.sync_to_db()` | Syncs registered canvases into `CanvasType`. |
| `AgentDef.default_open_canvases` | Associates canvases with an agent during definition sync. |
| `BaseCapability.get_default_canvases()` | Tells runtime which canvases to hydrate for active capability domains. |
| `get_initial_canvas_state(...)` | Builds initial state for a session/resource/canvas. |
| `CanvasInstance` | Persisted per-session canvas state. |

## Current Canvas Keys

| Key | Domain | Frontend renderer |
| --- | --- | --- |
| `VANIA_PATIENT_JOURNEY` | `vania_visitor` | `PatientJourneyCanvas` |
| `VANIA_PATIENT_MANAGER` | `vania_expert` | `PatientManagerCanvas` |

Keep these keys stable. They are used by backend capability code, synced DB rows, frontend dynamic imports, and legacy renderer mappings.

## Hydration Flow

```text
Agent runtime starts
  -> active capability domains resolved
  -> get_default_canvases()
  -> CanvasType lookup
  -> get_initial_canvas_state(...)
  -> CanvasInstance get_or_create
  -> frontend GET /agent/canvas/state/{session_id}
  -> CanvasPanel + CanvasRegistry render
```

Hydration can use resource context such as selected visitor, expert, or case. Visitor capability can also hydrate from the authenticated user's own state when no explicit resource ID is present.

## Update Flow

State changes can originate from tools or users.

Agent-originated changes:

```text
tool mutates domain state
  -> emits canvas refresh/update
  -> AG-UI CUSTOM event
  -> frontend useCanvasSync
  -> canvas store update with source="AGENT"
```

User-originated changes:

```text
renderer interaction
  -> canvas store update with source="USER"
  -> PATCH /agent/canvas/instance/{id}
  -> backend persistence/domain merge
```

## Demo Canvas Modes

Demo behavior comes from `DemoConfigDef.canvas_mode`:

- `HIDDEN`: do not show canvas.
- `LOCKED`: show canvas with lock/upgrade overlay.
- `OPEN`: allow normal canvas interaction.

Backend access still controls runtime execution. Canvas UI mode is presentation and interaction behavior, not security by itself.

## Adding Canvas Support to an Agent

1. Register a backend canvas class with `@register_canvas`.
2. Add the canvas key to the capability's `get_default_canvases()`.
3. Add the canvas key to relevant `AgentDef.default_open_canvases`.
4. Implement `get_initial_canvas_state()` when default state is not enough.
5. Add or expose a frontend renderer.
6. Run sync.
7. Verify chat hydration, tool updates, user edits, locked demo mode, and mobile layout.

## Canvas Integration Checklist

Before finishing canvas-related agent work:

- backend `component_key` matches frontend renderer resolution
- definition sync created `AgentCanvasConfig`
- capability sync created full `CanvasType` metadata
- runtime hydrates `CanvasInstance`
- tools emit refresh events after mutations
- frontend accepts both initial and incremental state
- demo lock behavior is correct

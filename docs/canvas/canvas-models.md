# Canvas Models

Canvas persistence lives in `backend/services/models_canvas.py`.

## CanvasType

`CanvasType` defines a canvas class synced from code.

| Field | Purpose |
| --- | --- |
| `name` | Display name. |
| `slug` | Stable unique slug, often versioned. |
| `description` | Context description for developers/LLM/admin. |
| `component_key` | Frontend renderer compatibility key. |
| `schema_definition` | Optional JSON schema for state validation/documentation. |
| `default_state` | Initial state when no capability-specific state exists. |
| `created_at` / `updated_at` | Audit timestamps. |

## AgentCanvasConfig

`AgentCanvasConfig` associates agents with canvas types.

| Field | Purpose |
| --- | --- |
| `agent` | Linked `AgentService`. |
| `canvas` | Linked `CanvasType`. |
| `is_default_open` | Whether the canvas should open automatically. |
| `permission_level` | `READ` or `WRITE`. |

The pair `(agent, canvas)` is unique.

Current runtime behavior mostly depends on capability hydration and frontend lock/read-only state. Do not assume `permission_level` alone enforces write security.

## CanvasInstance

`CanvasInstance` stores runtime state for one canvas in one chat session.

| Field | Purpose |
| --- | --- |
| `id` | UUID primary key used by frontend PATCH calls. |
| `session_id` | Chat/session identifier. |
| `canvas_def` | Linked `CanvasType`. |
| `current_state` | Live JSON state. |
| `is_visible` | Whether this canvas tab is visible/open. |
| `last_modified_at` | Updated on save. |
| `created_at` | Creation timestamp and ordering source. |

`session_id` is a string instead of a strict foreign key because agent session storage may live in Agno-managed tables or a different backend.

## Ordering

`CanvasInstance` orders by `created_at`. The frontend preserves backend ordering in `orderedIds`.

## Model Rules

- Keep `component_key` stable.
- Use versioned `slug` values when changing a canvas type significantly.
- Keep `default_state` valid for the renderer.
- Treat `current_state` as session state, not the only durable domain store.
- Add explicit domain persistence when a user edit changes product data.

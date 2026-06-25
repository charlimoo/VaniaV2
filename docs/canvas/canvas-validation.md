# Canvas Validation

Canvas changes should be validated across backend hydration, frontend rendering, user edits, tool events, context switches, and demo/read-only states.

## Docs Validation

Run from `docs/`:

```bash
pnpm build
```

## Backend Validation

Run relevant backend checks from `backend/`:

```bash
pytest
```

For canvas-specific work, prioritize tests or manual checks around:

- capability registration
- `python manage.py sync`
- `GET /agent/canvas/state/{session_id}`
- `PATCH /agent/canvas/instance/{id}`
- tool-generated `CanvasUpdateEvent`
- read-only case rejection
- stale base profile rehydration

## Frontend Validation

Run from `frontend/`:

```bash
pnpm exec tsc --noEmit
```

Use `pnpm build` when changing dynamic imports, renderer modules, route integration, or Next-specific behavior.

## Manual QA

Expert canvas:

- open expert agent without a visitor selected
- select a visitor
- select/create/rename/delete a case
- edit base profile
- edit clinical summary
- update roadmap/rescue net/medications/appendix/files where available
- verify read-only shared case controls
- verify canvas refresh after tool calls

Visitor canvas:

- open visitor agent
- view base profile
- open a case
- switch cases
- view tasks, medications, timeline, library, files
- update task/resource/test state where available
- verify case sharing flow

Responsive behavior:

- desktop side-by-side chat/canvas
- mobile chat view
- mobile canvas view
- sidebar and panel collapse behavior
- long content and scroll containers

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Canvas tab missing | `CanvasType`, `AgentCanvasConfig`, capability `get_default_canvases`, sync command. |
| Renderer not found | `component_key` mapping in `CanvasRegistry` and renderer export. |
| Empty expert canvas | selected visitor resource ID, `requires_visitor_selector`, hydration logs. |
| Wrong case shown | query params, context headers, selected case staleness rehydration. |
| User edit disappears after refresh | permanent persistence hook missing or hydration reads from old source. |
| Agent update does not render | `CanvasUpdateEvent` payload, AG-UI custom event handling, `canvas_id`. |
| Read-only user can edit | renderer disabled state and backend PATCH access check. |
| Arrays duplicate or vanish | remember arrays are overwritten during deep merge. |

## Completion Checklist

Before finishing canvas work:

- backend key and frontend renderer match
- sync has been run if definitions changed
- new state fields are typed
- user and agent update flows both work
- durable edits survive refresh
- demo/locked/read-only states are checked
- mobile and desktop layouts are checked

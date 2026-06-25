# Canvas UI

Canvas UI is the structured collaboration surface shown beside chat. Backend capabilities define canvas types and initial state; the frontend resolves canvas component keys into renderer modules and syncs user edits back to the runtime.

## Key Files

- `frontend/components/canvas/CanvasPanel.tsx`
- `frontend/components/canvas/CanvasRegistry.tsx`
- `frontend/components/canvas/renderers`
- `frontend/lib/canvas/store.ts`
- `frontend/lib/canvas/useCanvasSync.ts`

## Canvas Panel

`CanvasPanel` owns the visible canvas shell:

- filters visible canvas instances
- manages the active canvas tab
- renders lock/demo overlays
- passes renderer props through `CanvasRegistry`
- handles empty, loading, and locked states

The panel should stay renderer-agnostic. Domain-specific rendering belongs in `frontend/components/canvas/renderers`.

## Renderer Registry

`CanvasRegistry` dynamically imports renderer modules based on backend `component_key` values.

Known legacy mappings are preserved:

| Backend key | Renderer |
| --- | --- |
| `VANIA_PATIENT_JOURNEY` | `PatientJourneyCanvas` |
| `VANIA_PATIENT_MANAGER` | `PatientManagerCanvas` |

Do not remove legacy mappings without a coordinated backend and database migration.

## Renderer Contract

Renderers receive canvas identity, current state, edit callbacks, and lock state. They should:

- render from backend-provided state
- avoid inventing permanent default state on the frontend
- call the provided edit path for user changes
- respect locked/read-only modes
- keep Persian UI copy and RTL layout for product-facing text

## Canvas Store

`frontend/lib/canvas/store.ts` is a Zustand store for:

- canvas instances
- ordering
- active tab
- panel open state
- lock state
- selected visitor/patient, expert/doctor, and case context

`updateCanvas` deep-merges local changes and can persist user-originated updates through `PATCH /agent/canvas/instance/{id}`.

Agent-originated updates update local state through the AG-UI event path and should not immediately echo back as user PATCH requests.

## Canvas Sync Hook

`useCanvasSync` hydrates and updates canvas state for a chat session:

- `GET /agent/canvas/state/{threadId}?agent_id=...`
- forwards visitor/patient, expert/doctor, and case context
- subscribes to AG-UI lifecycle events
- locks while runs are active
- handles `CANVAS_UPDATE`
- handles `SESSION_RENAME`

Canvas hydration must remain resilient. If hydration fails, the chat page should not lose already-loaded conversation state.

## Adding a Canvas Renderer

To add a new canvas:

1. Register the canvas type in a backend capability.
2. Ensure definitions sync writes the canvas metadata.
3. Add the frontend renderer module.
4. Verify the backend `component_key` resolves in `CanvasRegistry`.
5. Render backend state and persist user edits through the canvas store.
6. Test locked, demo, desktop, and mobile states.

## Canvas UI Checklist

When changing canvas UI, verify:

- active tab behavior
- empty canvas behavior
- locked/demo overlays
- AG-UI `CANVAS_UPDATE` handling
- user edit PATCH behavior
- mobile layout
- legacy component key mappings

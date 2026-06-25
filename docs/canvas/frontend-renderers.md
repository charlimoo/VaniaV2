# Frontend Renderers

Frontend canvas renderers turn backend canvas state into interactive UI.

## Key Paths

- `frontend/components/canvas/CanvasPanel.tsx`
- `frontend/components/canvas/CanvasRegistry.tsx`
- `frontend/components/canvas/renderers`
- `frontend/lib/canvas`
- `frontend/lib/types/vania.ts`

## Responsibilities

- Resolve `component_key` values to renderer modules
- Render canvas state
- Handle read-only and locked modes
- Sync user edits
- Adapt to mobile and desktop layouts

## Renderer Registry

`frontend/components/canvas/CanvasRegistry.tsx` dynamically imports renderers.

Current key map:

| Backend `component_key` | Renderer file |
| --- | --- |
| `VANIA_PATIENT_MANAGER` | `frontend/components/canvas/renderers/PatientManagerCanvas.tsx` |
| `VANIA_PATIENT_JOURNEY` | `frontend/components/canvas/renderers/PatientJourneyCanvas.tsx` |

The registry also supports fallback module resolution, but explicit mappings are safer for legacy backend keys.

## Renderer Props

Renderers receive:

| Prop | Purpose |
| --- | --- |
| `canvasId` | Backend `CanvasInstance.id`, required for user PATCH sync. |
| `data` | Current state JSON from the store. |
| `onEdit` | Callback for user-originated partial deltas. |
| `isLocked` | Runtime/demo lock signal. |

## Patient Manager Renderer

`PatientManagerCanvas` is the expert canvas. It renders:

- visitor picker when no visitor is active
- shared base profile
- case list and case selection
- case overview
- roadmap
- rescue net
- medications
- appendix
- files
- form/test history and form submission surfaces

It must respect `can_edit` and `is_read_only` on selected cases.

## Patient Journey Renderer

`PatientJourneyCanvas` is the visitor canvas. It renders:

- shared base profile
- accessible cases
- case overview
- rescue net tasks
- medications
- timeline
- library/resources
- files
- case sharing flows

Visitor case switches may trigger a fresh canvas hydration request with selected expert/doctor and case context.

## Store and Sync

`frontend/lib/canvas/store.ts` owns:

- instances
- ordering
- active tab
- panel open state
- lock state
- resource/doctor/case context for PATCH headers

`updateCanvas(..., source="USER")` persists a PATCH in the background. `source="AGENT"` updates local state without echoing the agent event back to the backend.

## Locking

`useCanvasSync` sets `isLocked` during AG-UI runs and clears it on `RUN_FINISHED` or `RUN_ERROR`.

Renderers should disable or avoid mutating controls while locked. Case-level read-only restrictions are separate and must also be respected.

## Rules

- Keep renderer names and backend keys compatible.
- Preserve legacy key mappings when they exist.
- Avoid frontend-only bootstrapping for state the backend should own.
- Test affected renderers in chat context.
- Keep Persian UI copy and RTL layout.
- Use backend-provided `visible_tabs`, `feature_policy`, and `case_overview_sections` to decide what to show.
- Do not create a second source of truth for case/profile data in renderer-local state.

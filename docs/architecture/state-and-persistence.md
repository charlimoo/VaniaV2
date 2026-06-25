# State and Persistence

Vania has several kinds of state. Confusing them is a common source of bugs.

## State Types

| State | Owner | Persistence | Examples |
| --- | --- | --- | --- |
| Product/domain state | Django models | Durable | users, profiles, cases, medications, billing |
| Code-defined catalog state | `backend/definitions` plus sync | Durable after sync | agents, plans, professions, canvas configs |
| Chat session state | Agno storage | Durable thread state | messages, session metadata, attachments |
| Canvas instance state | `CanvasInstance.current_state` | Durable per session | patient manager JSON, patient journey JSON |
| Frontend UI state | Zustand and React state | In-memory browser state | active canvas tab, panel open, local hydration cache |
| Runtime context | Python context vars and request headers | Request scoped | active visitor, expert, case |
| Cache state | Django cache/Redis | Temporary | access decisions, demo usage counters |

## Chat Sessions

Chat sessions are keyed by `threadId`/`session_id`. They store message history and metadata used by the frontend and runtime.

Important metadata:

- Agent slug.
- Session title.
- Visitor/patient scope.
- Expert/doctor scope.
- Case scope.
- UI attachment metadata.
- Session knowledge metadata.

## Canvas Instances

Canvas instances are session-scoped and stored separately from chat history to avoid bloating message logs.

Important behavior:

- A session can have multiple canvas instances.
- Instances are ordered by creation time.
- `current_state` is JSON and is updated through merge semantics.
- Arrays are overwritten during merge, not appended.
- Some canvas PATCH requests also update durable domain state.

## Domain State Versus Canvas State

Canvas state is a working UI representation. Durable domain state belongs in domain models and services.

Examples of durable state that should not live only in canvas JSON:

- Patient demographics.
- Base profile.
- Case lists.
- Clinical summaries.
- Forms/tests analysis.
- Medication plans.

The canvas PATCH route contains hooks that persist these fields through `ProfileService`, `CaseService`, and `MedicationService` when the delta includes relevant keys.

## Frontend Canvas Store

The frontend canvas store:

- Hydrates from `/agent/canvas/state/{threadId}`.
- Tracks instances by id.
- Tracks ordered ids.
- Tracks active tab and panel open state.
- Tracks active resource, doctor, and case context for sync headers.
- Deep merges canvas deltas in the browser.
- Sends user-originated deltas to `/agent/canvas/instance/{id}`.

Important file:

- `frontend/lib/canvas/store.ts`

## Runtime Events

AG-UI stream events are transient transport state. They should update UI and, when needed, be backed by persistent writes.

Important custom events:

- `CANVAS_UPDATE`: update a canvas instance in the frontend store.
- `SESSION_RENAME`: update thread title in the frontend.
- `assistant_output_complete`: signal text/tool output has been idle long enough for UI affordances.
- `billing_required`: prompt billing flow after insufficient credits.

## Persistence Rules

- Persist durable product changes before or alongside canvas refresh events.
- Use canvas JSON for session-specific working state.
- Use session metadata for thread-level context labels and attachment metadata.
- Use frontend state only as a cache of backend state.
- If a state update must survive a browser refresh and a new thread, it probably belongs in a Django domain model.

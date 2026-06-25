# State Management

Frontend state is split across React providers, Zustand stores, adapter-managed runtime state, and server data fetched from backend APIs.

## State Layers

| Layer | Purpose |
| --- | --- |
| React providers | App-wide auth, config, theme, layout context |
| Zustand stores | Canvas, selected Vania context, feature-specific UI state |
| AG-UI runtime | Active thread messages, run state, streaming lifecycle |
| Backend APIs | Source of truth for auth, access, sessions, billing, canvas, domain data |

Do not make browser state the only source of truth for role access, billing access, canvas persistence, or agent session ownership.

## User State

`UserProvider` owns authenticated profile state and exposes it through `useUserContext` or related hooks. Components should consume this provider instead of refetching `/api/auth/profile/` independently.

## Canvas State

`useCanvasStore` owns canvas instances and collaboration context. It is both UI state and a sync coordinator for user-originated canvas edits.

Canvas state has two update sources:

- `USER`: local interaction that should be persisted to the backend.
- `AGENT`: runtime event that should update local UI without echoing back as a user edit.

## Vania Context State

`frontend/lib/vania/store.ts` keeps active patient/visitor context for Vania-specific flows. Keep it aligned with chat query params and backend session state when linking from dashboard into chat.

## Runtime State

The AG-UI runtime owns active message and run state for chat. Avoid duplicating runtime message state in page-local React state unless the duplicate state is purely presentational.

## URL State

Chat routes use URL query params for visitor/patient, expert/doctor, and case context. This makes selected context restorable after refresh and shareable across internal navigation.

Do not move scoped chat context into memory-only state unless the backend and navigation flows are updated as well.

## State Change Checklist

When adding state:

- decide whether backend, URL, provider, store, or component state should own it
- avoid duplicating source-of-truth data
- preserve role/context aliases where needed
- reset state on logout if it contains user-specific data
- verify refresh and back/forward navigation behavior

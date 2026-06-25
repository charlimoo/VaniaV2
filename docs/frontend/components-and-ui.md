# Components and UI

Frontend UI is organized around reusable product components, route-specific feature components, Assistant UI integration, and canvas renderers.

## Important Component Areas

| Path | Purpose |
| --- | --- |
| `frontend/components/ui` | Shared UI primitives and wrappers |
| `frontend/components/sidebar` | Dashboard and chat navigation shells |
| `frontend/components/global-header` | Shared header surfaces |
| `frontend/components/chat` | Chat page components |
| `frontend/components/assistant-ui` | Assistant UI integration and tool/message rendering |
| `frontend/components/canvas` | Canvas shell, registry, and renderers |
| `frontend/components/billing` | Billing and access-related UI |
| `frontend/components/settings` | Profile/settings flows |
| `frontend/components/providers` | App-level React providers |

## UI Libraries

The frontend uses Radix UI primitives, local component wrappers, Tailwind CSS, and `lucide-react` icons.

Prefer existing component wrappers before adding a new UI primitive. This keeps spacing, variants, direction, and accessibility behavior consistent.

## Assistant UI Components

Assistant UI components render chat messages, tool output, composer behavior, attachments, and runtime state. They are connected to the custom AG-UI runtime through `frontend/lib/ag-ui`.

When changing assistant components, check both normal message rendering and streamed partial output.

## Canvas Renderers

Canvas renderers are domain-specific components under `frontend/components/canvas/renderers`. They should receive state and callbacks from the canvas shell instead of fetching unrelated backend state directly.

If a renderer needs canonical domain data, prefer adding it to the backend canvas state or a capability endpoint rather than creating a second unsynchronized source.

## Product Copy

Product-facing UI copy should be Persian. Contributor-facing comments, docs, and PR notes should be English.

Avoid mixed-language controls unless the surrounding feature already uses them intentionally.

## Component Change Checklist

When changing shared components:

- check both desktop and mobile layouts
- verify RTL behavior
- verify loading, empty, error, and disabled states
- keep button/icon semantics accessible
- reuse role helpers for role-specific presentation
- run TypeScript validation

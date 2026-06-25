# Repository Tour

Vania is a full-stack monorepo with a Django backend and a Next.js frontend.

## Top-Level Directories

- `backend/`: Django APIs, FastAPI/agent runtime wiring, services, billing, users, definitions, capabilities.
- `frontend/`: Next.js App Router application, dashboard, chat workspace, canvas UI, shared client libraries.
- `docs/`: VitePress technical documentation.
- `.vscode/`: local development tasks.

## High-Value Backend Paths

- `backend/definitions/agents`: code-defined agent metadata.
- `backend/capabilities`: capability domains, tools, canvases, forms, prompt/context hooks.
- `backend/agents`: agent session lifecycle, AG-UI streaming, attachments, sharing.
- `backend/services`: service discovery, access rules, serializers, canvas models.
- `backend/users`: roles, auth, profile and expert-specific rules.

## High-Value Frontend Paths

- `frontend/app/(chat)/chat`: chat workspace routes.
- `frontend/app/(dashboard)`: authenticated dashboard routes.
- `frontend/components/canvas`: canvas panel, registry, and renderers.
- `frontend/components/chat`: chat shell and chat-adjacent controls.
- `frontend/lib`: API configuration, stores, adapters, shared types.

## Documentation Rule

When documenting a feature, link the feature concept to the exact backend and frontend paths that own it.

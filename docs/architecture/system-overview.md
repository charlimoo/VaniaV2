# System Overview

Vania V2 is a role-aware AI collaboration platform. Users work with specialized AI agents in a chat workspace, and agents can also read, hydrate, and update structured canvas state beside the conversation.

The system is built as a full-stack monorepo:

- `backend/`: Django, Django REST Framework, FastAPI agent runtime, capability system, billing, access rules, canvas persistence, and Vania domain services.
- `frontend/`: Next.js App Router app, chat workspace, canvas UI, dashboard flows, public pages, stores, and API adapters.
- `docs/`: VitePress developer documentation.

## Core Concepts

- **Agents** define who the assistant is, which audience can use it, and which capabilities it has.
- **Capabilities** define what an agent can do: tools, canvases, forms, prompt fragments, context hooks.
- **Canvas** is the structured collaboration surface beside chat.
- **Roles** decide what a user can see and use.
- **Definitions sync** copies code-defined product definitions into database-backed service records.
- **Runtime context** carries active visitor/patient, expert/doctor, and case scope across frontend, backend, agent, canvas, and domain APIs.

## Main Applications

- **Django app**: handles normal `/api/...` routes, auth, billing, service discovery, domain data, definitions sync, and most persistent business state.
- **FastAPI agent runtime**: mounted at `/agent`, handles AG-UI streaming, session operations, file preparation, canvas hydration, and canvas instance updates.
- **Next.js frontend**: renders authenticated and public product surfaces, wires AG-UI runtime, and manages canvas state through client stores.
- **Local infrastructure**: database, Redis/cache, Celery, Qdrant, object storage, and other optional services depending on the workflow.

## High-Level Route Map

```text
Browser
  |
  | Next.js app
  v
Frontend API calls
  |
  | /api/...      -> Django and DRF
  | /agent/...    -> FastAPI agent runtime
  v
Backend
  |
  | Django models, Agno storage, capability registry,
  | canvas models, billing, domain services
  v
Database and external services
```

## Source of Truth Layers

| Concern | Source of truth | Runtime consumer |
| --- | --- | --- |
| Agent identity and metadata | `backend/definitions/agents` | `AgentService` records and frontend service discovery |
| Agent access and billing | backend access and eligibility services | service discovery and agent runtime |
| Capability behavior | `backend/capabilities` | agent factory, form submit, canvas hydration |
| Canvas type contract | capability canvas class plus `CanvasType.component_key` | canvas routes and frontend registry |
| Chat session history | Agno session storage | agent runtime and frontend history UI |
| Domain data | Django apps such as `vania_core`, `users`, `billing` | APIs, capabilities, tools, canvas hydration |

## Architectural Invariants

- Agent metadata starts in `backend/definitions/agents`.
- Capability behavior belongs in `backend/capabilities`.
- Access rules must be enforced on the backend, not only hidden in the frontend.
- Canvas contracts must stay aligned across backend `component_key`, synced database records, and frontend renderer resolution.
- Chat context must preserve visitor/patient, expert/doctor, and case aliases.
- Tools that mutate product state should persist through domain services or canvas routes, not only through chat text.
- Frontend UI can optimize the experience, but backend rules decide eligibility, billing access, and resource permissions.

## Key Files

| Area | Files |
| --- | --- |
| ASGI mount and backend route boundary | `backend/core/asgi.py`, `backend/core/urls.py`, `backend/agents/app.py` |
| Agent definitions and sync | `backend/definitions/base.py`, `backend/definitions/agents`, `backend/definitions/sync.py` |
| Service discovery and access | `backend/services/views.py`, `backend/services/serializers.py`, `backend/services/access_service.py`, `backend/users/eligibility.py` |
| Agent runtime | `backend/agents/routes.py`, `backend/agents/factory.py`, `backend/agents/stream.py` |
| Capability system | `backend/capabilities/base.py`, `backend/capabilities/registry.py`, `backend/capabilities/*` |
| Canvas backend | `backend/canvas/routes.py`, `backend/canvas/manager.py`, `backend/services/models_canvas.py` |
| Canvas frontend | `frontend/components/canvas`, `frontend/lib/canvas` |
| Chat frontend | `frontend/app/(chat)/chat/[agentId]/[threadId]/page.tsx`, `frontend/lib/SimpleThreadAdapters.ts` |

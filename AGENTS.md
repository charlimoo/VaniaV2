# AGENTS.md

## Project Overview

Vania V2 is a collaborative AI platform where humans work alongside specialized AI agents on real tasks. The product is built around a shared workspace concept called **canvas**: a structured UI surface where agents and humans can view, edit, and collaborate on domain-specific data next to the chat.

This repository is a full-stack monorepo with:

- `backend/`: Django-based application APIs, agent definitions, capability system, billing, role/eligibility logic, and Vania domain services.
- `frontend/`: Next.js 16 + React 19 application for chat, canvas UI, dashboard flows, billing, profile management, and public share pages.

The app is Persian-first in the UI, but contributors and agents working on the repo should communicate with collaborators in English unless explicitly asked otherwise.

## Core Product Concepts

### 1. Agents

Agents are the main AI assistants users interact with. Each agent has a code-defined configuration that is later synced into database-backed `AgentService` records.

Key location:

- `backend/definitions/agents`

Agents are defined through `AgentDef` objects in:

- `backend/definitions/base.py`

Important agent properties include:

- `slug`, `name`, `description`, `system_prompt`, `model_id`
- `audience`: `ALL`, `VISITOR`, or `EXPERT`
- `eligible_expert_professions`: fine-grained expert filtering
- `requires_visitor_selector`: whether an expert must select a visitor before use
- `capabilities`: capability domains that provide tools, canvases, and prompt/context hooks
- `default_open_canvases`
- `demo_config`: demo access, message limits, and canvas restrictions
- `extra_config`: UI-level configuration such as canvas layout behavior

### 2. Capabilities

Capabilities are the main backend extension mechanism for agent behavior.

Key location:

- `backend/capabilities`

They are responsible for things like:

- Registering tools
- Registering canvases
- Registering form handlers
- Adding system prompt fragments
- Providing resource-aware context
- Providing initial canvas state for a given resource

The registry lives in:

- `backend/capabilities/registry.py`

Current capability domains include:

- `core`
- `vania_visitor`
- `vania_expert`

When extending the platform, prefer putting domain logic into capabilities instead of hardcoding it into agent route handlers.

### 3. Canvas

Canvas is a first-class collaboration surface where humans and AI work on structured data together. Chat and canvas are meant to complement each other, not compete.

Frontend canvas UI lives in:

- `frontend/components/canvas`

Key files:

- `frontend/components/canvas/CanvasPanel.tsx`
- `frontend/components/canvas/CanvasRegistry.tsx`
- `frontend/components/canvas/renderers/*`

Backend canvas types and syncing are connected through:

- `backend/capabilities/*/canvas.py`
- `backend/capabilities/registry.py`
- `backend/services/models_canvas.py`
- `backend/definitions/sync.py`

Important behavior:

- Backend capabilities register canvas classes by `component_key`.
- Synced canvas types are stored in the database.
- Frontend dynamically resolves `componentKey` values to renderer modules.
- Legacy backend keys may be mapped to renderer filenames in `CanvasRegistry.tsx`.

If you add a new canvas:

1. Register it in backend capability code.
2. Ensure it is synced into DB via the definition/capability flow.
3. Add or expose the matching frontend renderer.
4. Verify the backend `component_key` matches the frontend loader behavior.

### 4. Roles

This platform has two main user roles:

- `visitor`
- `expert`

Role helpers live in:

- `backend/users/roles.py`

Expert users can also have subtypes/professions, such as:

- psychologist
- psychiatrist
- lawyer
- general doctor

This affects:

- Which agents are visible
- Which dashboard flows are available
- Which profile/settings forms are shown
- Eligibility for subscription plans
- Which expert-specific capabilities and visitor-selection flows are enabled

Do not assume all experts are interchangeable. Expert profession constraints are a real product rule.

### 5. Context Scoping

The chat system supports scoped collaboration contexts, especially for expert/visitor workflows.

Important context identifiers:

- `visitorId` / `patientId`
- `expertId` / `doctorId`
- `caseId`

Frontend chat route:

- `frontend/app/(chat)/chat/[agentId]/[threadId]/page.tsx`

Backend agent runtime routes:

- `backend/agents/routes.py`

Important behavior:

- Frontend preserves context in query params.
- Query params are normalized across old/new aliases.
- Context is forwarded to backend through headers like:
  - `X-Target-Resource-ID`
  - `X-Target-Expert-ID`
  - `X-Target-Doctor-ID`
  - `X-Target-Case-ID`
- Backend normalizes alias fields in session state and uses them to restore collaboration context.

When changing chat/session logic, preserve compatibility with both `visitor/patient` and `expert/doctor` naming, because both conventions are still used in parts of the codebase.

## Architecture Summary

### Backend

The backend is primarily Django + DRF, with a FastAPI/agent runtime layer used for AG-UI streaming and agent session operations.

Key backend areas:

- `backend/core`: Django settings and root URL configuration
- `backend/users`: auth, roles, expert validation, user models
- `backend/billing`: plans, products, payments, credits, invoices
- `backend/services`: agent service discovery, serializers, access logic, form submission, canvas DB models
- `backend/agents`: session lifecycle, AG-UI stream endpoint, attachments, sharing, runtime wiring
- `backend/definitions`: code-first definitions for agents, billing, support, sync
- `backend/capabilities`: capability registry and domain-specific extensions
- `backend/vania_core`: core Vania domain APIs and models

Root Django URLs:

- `backend/core/urls.py`

Key exposed API groups:

- `/api/auth/`
- `/api/billing/`
- `/api/services/`
- `/api/vania/`

Important backend patterns:

- Agent services are code-defined, then synced into database records.
- Visibility/access is filtered by user eligibility.
- Generic form submission is capability-driven.
- Chat history/session metadata are persisted in agent session storage.
- Attachments can be pre-processed and ingested for knowledge/RAG.
- Demo access and usage limits are enforced before starting a run.

### Frontend

The frontend is a Next.js App Router app.

High-level route groups:

- `frontend/app/(chat)`: chat workspace
- `frontend/app/(dashboard)`: authenticated product/dashboard flows
- `frontend/app/(public)`: public share/support/terms pages

Important frontend areas:

- `frontend/app/(chat)/chat`: agent chat experience
- `frontend/components/canvas`: canvas system
- `frontend/components/chat`: chat panel and chat-adjacent UI
- `frontend/components/assistant-ui`: tool rendering and runtime integration
- `frontend/lib`: shared types, stores, adapters, API config, state

Important runtime behaviors on the chat page:

- Service metadata is fetched from `/api/services/`
- The AG-UI runtime is wired through `@ag-ui/client` and `@assistant-ui/react`
- Canvas state is hydrated/synced separately
- Thread context may be restored from backend session state
- Mobile and desktop layouts differ significantly

When making chat changes, consider:

- draft vs persisted threads
- preview/demo mode
- role-based access differences
- canvas visibility/locking behavior
- visitor/expert/case context restoration
- mobile layout behavior

## Source of Truth Rules

Use these rules when changing the system:

- Agent metadata belongs in `backend/definitions/agents` first.
- Capability behavior belongs in `backend/capabilities`.
- Role/eligibility rules belong in backend user/access logic, not only in frontend hiding.
- Canvas contracts must stay aligned across backend `component_key`, synced DB records, and frontend renderer resolution.
- UI labels/content inside the product should be Persian unless there is a clear product reason not to.
- Contributor-facing explanations, PR notes, and terminal communication should stay in English.

## Development Workflow

### Package Managers and Environments

Use:

- `pnpm` for frontend
- `venv` for backend

Backend virtual environment is expected to be used from the repo’s Python setup.

### Frontend Commands

Run from:

- `frontend/`

Common commands:

```bash
pnpm install
pnpm dev
pnpm build
pnpm exec tsc --noEmit
```

Important note:

- Do not rely on `pnpm lint` here for validation. The current Next CLI setup makes `next lint` invalid in this project.
- Use `pnpm exec tsc --noEmit` as the primary frontend validation command.

### Backend Commands

Run from:

- `backend/`

Common commands:

```bash
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
pytest
```

This project also includes agent/runtime-related dependencies such as FastAPI, AG-UI, Celery, Redis, Qdrant, and S3/MinIO-compatible storage support. Be aware that some features may depend on local services or environment variables being present.

## Sync and Bootstrap

The project uses a code-first sync model for important definitions.

Main sync entry area:

- `backend/definitions/sync.py`

This sync layer is responsible for populating/updating:

- agent services
- service suggestions
- default canvas configs
- plans and products
- discounts
- FAQs
- locations
- expert professions
- a default admin user for development

If you add a new agent, plan, profession, or support definition, make sure the sync path remains valid.

## Working With Agents

When adding or updating an agent:

1. Start in `backend/definitions/agents`.
2. Keep the agent’s audience and profession constraints accurate.
3. Attach capabilities instead of embedding all logic into the agent definition.
4. Define demo behavior deliberately.
5. If the agent uses canvas, ensure its default canvases and UI config are coherent.
6. Verify the frontend can render the expected canvases and handle preview/locked modes.

When adding a brand-new capability:

1. Create it under `backend/capabilities/<domain>`.
2. Register tools/canvases/form handlers through the registry decorators.
3. Make sure autodiscovery will import it successfully.
4. Keep prompt/context hooks narrow and domain-specific.
5. Prefer capability-based initial state loading rather than frontend-only bootstrapping.

## Working With Canvas

When changing canvas behavior:

- Check both the backend state producer and the frontend renderer.
- Preserve existing `component_key` compatibility unless there is a migration plan.
- Be careful with lock/demo modes because canvases may be visible, hidden, or read-only depending on subscription state.
- Validate both mobile and desktop behavior.
- Keep canvas edits compatible with the store/sync flow used by the chat page and canvas store hooks.

## Working With Roles and Eligibility

Role-sensitive changes should be treated as backend rules first and frontend presentation second.

Always verify:

- whether the feature is visitor-only, expert-only, or shared
- whether expert profession filtering matters
- whether a visitor selector is required before the agent can be used
- whether billing/plan access changes should affect discovery and demo behavior

Frontend hiding alone is not sufficient for access control.

## Content and Localization Rules

- Speak to collaborators in English.
- Write in-product UI copy in Persian when editing user-facing text in the app.
- Preserve existing Persian terminology where possible.
- Avoid introducing mixed-language UI unless the feature already uses it.

## Testing and Validation Expectations

For frontend-oriented changes:

- Run `pnpm exec tsc --noEmit`
- Check affected chat/canvas/dashboard flows manually when possible

For backend-oriented changes:

- Run relevant Django tests or `pytest` where feasible
- Validate affected API routes
- Be especially careful around auth, role gating, session state, and capability registration

For full-stack agent/canvas changes:

- Verify service discovery still returns the expected agents
- Verify the correct role can see/use the agent
- Verify thread context restoration still works
- Verify canvas loads with the expected backend state
- Verify preview/demo restrictions still behave correctly

## Repository-Specific Guardrails

- Do not use `git status` as a decision-making tool in this repo; there may be many unrelated uncommitted changes.
- Do not make assumptions based on a clean worktree.
- Let the user handle commits unless explicitly asked to prepare one.
- Prefer targeted inspection of only the files relevant to the task.
- Keep compatibility with existing alias terms such as `visitor/patient` and `expert/doctor` unless the task explicitly includes a coordinated cleanup.

## High-Value Files and Directories

If you are new to the codebase, these are the most useful starting points:

- `backend/definitions/agents`
- `backend/definitions/base.py`
- `backend/definitions/sync.py`
- `backend/capabilities/registry.py`
- `backend/services/views.py`
- `backend/agents/routes.py`
- `backend/users/roles.py`
- `frontend/app/(chat)/chat/[agentId]/[threadId]/page.tsx`
- `frontend/components/canvas/CanvasRegistry.tsx`
- `frontend/components/canvas/renderers`
- `frontend/lib/types.ts`

## Practical Contributor Checklist

Before finishing a change, quickly check:

1. Did I modify the correct layer: definition, capability, service, runtime, or UI?
2. Did I preserve role-specific behavior for visitors vs experts?
3. Did I keep expert profession rules intact where relevant?
4. Did I preserve visitor/expert/case context flow?
5. Did I keep backend canvas keys and frontend renderers aligned?
6. Did I keep user-facing app text in Persian?
7. Did I validate with `pnpm exec tsc --noEmit` for frontend work and appropriate backend tests for backend work?

## Summary

Think of this project as a role-aware, capability-driven AI collaboration platform:

- agents define who the assistant is
- capabilities define what the assistant can do
- canvas defines where humans and AI collaborate in structured form
- roles and profession rules define who can see and use what
- chat carries context, while canvas makes that context actionable

When in doubt, preserve these core invariants:

- role-aware behavior
- capability-driven extensibility
- backend/frontend canvas alignment
- Persian product UI
- English collaborator communication

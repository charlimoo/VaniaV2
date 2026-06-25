# Application Boundaries

Vania has two backend application surfaces and one frontend application surface. Understanding where a request lands is the first step when debugging.

## Backend Surfaces

### Django and DRF

Django owns standard product APIs under `/api/...`.

Mounted in:

- `backend/core/urls.py`

Main route groups:

- `/api/auth/`: users, auth, roles, profile, expert verification.
- `/api/billing/`: plans, products, payments, credits, invoices.
- `/api/services/`: service discovery and capability form submission.
- `/api/vania/`: Vania domain APIs.

Django should own:

- Durable product data.
- Auth and user profile state.
- Role, profession, and plan eligibility.
- Service discovery.
- Billing.
- Domain APIs.
- Definition sync.

### FastAPI Agent Runtime

FastAPI is mounted under `/agent`.

Mounted in:

- `backend/core/asgi.py`
- `backend/agents/app.py`

Main route groups:

- `/agent/sessions`: session list, create, update, delete, history.
- `/agent/agui`: AG-UI streaming chat endpoint.
- `/agent/attachments`: attachment preparation and deletion.
- `/agent/share`: public share endpoints.
- `/agent/canvas/state`: canvas hydration.
- `/agent/canvas/instance`: canvas instance updates.

FastAPI should own:

- Streaming agent execution.
- AG-UI protocol conversion.
- Agno session operations.
- Runtime cancellation.
- Runtime attachment preparation.
- Canvas hydration and session-level canvas updates.

## Frontend Surface

The Next.js app owns:

- Chat workspace.
- Canvas panel and renderers.
- Dashboard pages.
- Public pages.
- Client stores and API adapters.

Key route groups:

- `frontend/app/(chat)`
- `frontend/app/(dashboard)`
- `frontend/app/(public)`

## Boundary Rules

- If behavior is a persistent product rule, enforce it in the backend.
- If behavior is agent-specific but domain-oriented, put it in a capability.
- If behavior is a UI rendering concern, put it in the frontend.
- If behavior connects backend canvas state to frontend canvas rendering, document and preserve the `component_key` contract.
- If behavior crosses chat, canvas, and domain data, document the context headers and the durable state owner.

## Common Ownership Decisions

| Change | Preferred owner |
| --- | --- |
| Add a new agent | `backend/definitions/agents` |
| Add tools for an agent domain | `backend/capabilities/<domain>` |
| Add a new canvas type | capability canvas registration plus frontend renderer |
| Change who can access an agent | backend definition and eligibility/access logic |
| Change chat layout | `frontend/app/(chat)` and chat/canvas components |
| Change permanent patient/case data | `backend/vania_core` domain services |
| Change service discovery fields | `backend/services/serializers.py` and frontend consumers |

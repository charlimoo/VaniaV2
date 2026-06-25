# Data Model

This page explains the persistent objects that shape Vania behavior and which architectural layer owns them.

## Model Map

| Area | Owning app/module | Purpose |
| --- | --- | --- |
| Users and roles | `backend/users` | Auth identity, role, expert profession, verification, profile context |
| Agent services | `backend/services` | Database-backed service records synced from code-defined agents |
| Billing | `backend/billing` | Plans, products, wallet state, credits, invoices, discounts |
| Canvas | `backend/services/models_canvas.py` | Canvas types, agent canvas configs, session canvas instances |
| Shared links | `backend/services/models.py` | Public read-only chat shares |
| Knowledge | `backend/services/models.py`, `backend/services/rag_service.py` | Static knowledge bases and session-level attachment knowledge |
| Agent sessions | Agno storage via `backend/agents/storage.py` | Chat history, run data, session metadata |
| Vania domain data | `backend/vania_core` | Visitor/expert relationships, cases, profile entries, medications, tests, clinical data |
| Definitions | `backend/definitions` | Code-first source for agents, billing catalog, support data, locations, professions |

## Users, Roles, and Professions

Role-sensitive behavior starts with the authenticated user and their role/profession fields.

Important rules:

- `visitor` and `patient` are aliases in some parts of the system.
- `expert` and `doctor` are aliases in some parts of the system.
- Experts must be verified to access `EXPERT` audience agents.
- Expert profession slugs can restrict which expert agents and plans are available.
- Staff/admin users bypass normal eligibility and plan restrictions.

Important files:

- `backend/users/roles.py`
- `backend/users/eligibility.py`
- `backend/users/models.py`

## AgentService

`AgentService` is the database-backed runtime representation of an agent.

Important fields:

- `slug`: stable URL and service identifier.
- `system_prompt`: synced static prompt content.
- `model_id`: default model used by runtime.
- `demo_config`: behavior for users without paid access.
- `is_free`, `audience`, `eligible_expert_professions`, `requires_visitor_selector`: access and UI behavior.
- `capabilities`: capability domains loaded at runtime.
- `extra_config`: frontend UI configuration.
- `plans`: subscription plans that unlock paid agents.
- `knowledge_bases`: optional static RAG sources.

Source of truth:

- Code definition: `backend/definitions/agents`
- Dataclass contract: `backend/definitions/base.py`
- Synced model: `backend/services/models.py`
- Sync logic: `backend/definitions/sync.py`

## Canvas Models

Canvas state is split into type metadata, agent support config, and per-session state.

### CanvasType

Represents a canvas class.

Important fields:

- `component_key`: backend/frontend compatibility key.
- `slug`: stable database slug.
- `name`: display name.
- `description`: LLM-facing description.
- `schema_definition`: optional JSON schema.
- `default_state`: fallback initial state.

### AgentCanvasConfig

Connects an agent to a canvas type.

Important fields:

- `agent`
- `canvas`
- `is_default_open`
- `permission_level`

### CanvasInstance

Represents live canvas state for a chat session.

Important fields:

- `session_id`: Agno session/thread id.
- `canvas_def`: `CanvasType`.
- `current_state`: live JSON state.
- `is_visible`: persisted UI visibility.
- `last_modified_at`

Important files:

- `backend/services/models_canvas.py`
- `backend/canvas/routes.py`
- `backend/canvas/manager.py`
- `frontend/lib/canvas/store.ts`

## Agent Sessions

Agent sessions are stored through Agno storage adapters selected at runtime:

- `SqliteDb` when `DATABASE_CONNECTION_STRING` is sqlite.
- `PostgresDb` otherwise.

Session data can include:

- `name` and `session_name`
- `agent_id`
- `visitor_id` and `patient_id`
- `selected_expert_id` and `selected_doctor_id`
- `selected_case_id`
- selected case labels/profession metadata
- `ui_attachments`
- session knowledge metadata

Important files:

- `backend/agents/storage.py`
- `backend/agents/routes.py`
- `backend/agents/session_metadata.py`
- `backend/agents/stream.py`

## Billing Models

Billing state affects service access and demo behavior.

Important concepts:

- Plans grant access to included agent slugs through many-to-many relation to `AgentService`.
- Products can grant credits or activate plans.
- Wallet active plan decides whether a paid agent is owned.
- Demo limits are checked at runtime when access is missing.

Important files:

- `backend/billing/models.py`
- `backend/billing/services.py`
- `backend/services/access_service.py`
- `backend/services/usage.py`
- `backend/definitions/billing.py`

## Knowledge Models

Knowledge has two forms:

- Static `KnowledgeBase` and `KnowledgeDocument` records connected to agents.
- Session-level uploaded PDF knowledge keyed by thread/session.

The agent factory prefers session knowledge when available, otherwise it can initialize a static knowledge base for the service.

## Domain Data

`vania_core` owns product-specific clinical, case, profile, and collaboration data. Capabilities and canvas hydration use this layer to build structured state for visitor and expert workflows.

Important patterns:

- Canvas JSON is not the only persistence layer.
- Some canvas PATCH operations also persist permanent profile, case, medication, or clinical summary data.
- Domain services should own durable product state when the state must survive beyond one canvas instance.

## Persistence Rules

- Treat code definitions as source of truth for synced catalog data.
- Treat Django domain models as source of truth for durable product state.
- Treat `CanvasInstance.current_state` as session-level working state.
- Treat frontend Zustand stores as cached UI state only.
- Never rely on chat messages as the only record of a state-changing action.

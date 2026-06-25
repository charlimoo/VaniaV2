# Services and Access

The `services` app owns database-backed agent service records, service discovery, access status serialization, RAG metadata, shared links, canvas models, and capability-backed form submission.

## Key Files

| File | Purpose |
| --- | --- |
| `backend/services/models.py` | `AgentService`, suggestions, tools, knowledge, shared links |
| `backend/services/models_canvas.py` | Canvas type/config/instance models |
| `backend/services/views.py` | Service discovery, debug context, form submit |
| `backend/services/serializers.py` | Service discovery response contract |
| `backend/services/access_service.py` | Permission checks and access cache |
| `backend/services/usage.py` | Demo usage limits |
| `backend/services/rag_service.py` | Knowledge ingestion/search helpers |
| `backend/services/tasks.py` | RAG and maintenance Celery tasks |

## Main Models

- `AgentService`: synced runtime service record for an agent.
- `ServiceSuggestion`: prompt suggestions shown in the UI.
- `AvailableTool`: DB-backed custom tool registry.
- `KnowledgeBase`: static RAG collection metadata.
- `KnowledgeDocument`: uploaded knowledge documents and ingestion status.
- `SharedLink`: public read-only chat share record.
- `CanvasType`, `AgentCanvasConfig`, `CanvasInstance`: canvas system models.

## Service Discovery

`GET /api/services/` returns active agent services for the authenticated user.

Flow:

```text
ServiceListView
  -> active/public AgentService query
  -> role/profession eligibility filter
  -> active wallet plan lookup
  -> ServiceSerializer
```

Serializer fields include:

- agent metadata
- `is_owned`
- `access_status`
- `audience`
- `eligible_expert_professions`
- `requires_visitor_selector`
- `reasoning_type`
- `capabilities`
- `ui_config`
- `supported_canvases`
- `input_requirements`
- `demo_config`
- `current_usage`

## Access Service

`backend/services/access_service.py` decides whether a user can run an agent.

Access order:

1. Cache lookup.
2. Agent exists.
3. Agent is active.
4. Staff/admin bypass.
5. Role/profession eligibility.
6. Free agent access.
7. Wallet active plan exists.
8. Active plan includes the agent.

Cache keys include a per-user version. Billing or plan changes should call `access_service.bump_user_cache_version(user.id)`.

## Demo Usage

`backend/services/usage.py` manages demo limits.

Supported scopes:

- `SESSION`: counts persisted user messages in the current session.
- `DAILY`: cache key for the current day.
- `TOTAL`: cache key without timeout.
- `NONE`: no demo limit.

Demo access is checked by `/agent/agui` before the agent run starts.

## Form Submission

`POST /api/services/forms/submit/` executes capability form handlers.

Request handler resolution:

- `handler`
- `form_handle`
- `definition.handler`

The view uses `CapabilityRegistry.get_handler(handler_key)` and calls `process(user, data, session_id, resource_id)`.

Rules:

- Handler keys are backend/frontend contracts.
- Validate all form data on the backend.
- Check resource permissions inside the handler or called domain service.

## Debug Context

`GET /api/services/debug-context/<slug>/` returns prompt/context layers for a service. It is useful when debugging why an agent sees certain profile, selection, capability, or resource context.

It reports:

- shared prompt layer
- static service prompt
- capability prompt additions
- runtime injected context
- active capability/resource/session sources

## Backend Rules

- Service discovery is not runtime authorization. Runtime access must be checked again.
- Keep serializer changes coordinated with frontend types/usage.
- Do not make capability form handlers depend on frontend-only validation.
- Keep `supported_canvases` aligned with synced `AgentCanvasConfig` rows.

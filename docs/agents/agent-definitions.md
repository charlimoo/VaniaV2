# Agent Definitions

Agents are code-defined through `AgentDef` objects and later synced into `AgentService` database records. Definitions are the source of truth for agent metadata, access targeting, capability domains, default canvases, demo behavior, suggestions, and frontend UI configuration.

## Key Paths

- `backend/definitions/agents`
- `backend/definitions/base.py`
- `backend/definitions/sync.py`
- `backend/services/models.py`
- `backend/services/serializers.py`

## Definition Object

`AgentDef` lives in `backend/definitions/base.py`.

| Field | Purpose |
| --- | --- |
| `slug` | Stable URL/runtime identifier. Must be unique. |
| `name` | Product display name. Usually Persian. |
| `model_id` | Default model used by the runtime. |
| `description` | Product description for discovery/UI surfaces. |
| `system_prompt` | Agent-specific base instructions. |
| `is_free` | Whether the agent is available without a paid plan. |
| `audience` | `ALL`, `VISITOR`, or `EXPERT`. |
| `eligible_expert_professions` | Expert profession slugs allowed to see/use this agent. |
| `requires_visitor_selector` | Whether expert UI must select a visitor/case first. |
| `demo_config` | Message limits, model override, and canvas lock behavior for users without access. |
| `capabilities` | Capability domains to load at runtime. |
| `tags` | UI filtering/display tags. |
| `user_guide` | Markdown guide shown in product surfaces. |
| `is_public` | Whether the service is discoverable through public service listing. |
| `is_active` | Whether runtime can instantiate the service. |
| `cost_multiplier` | Billing/runtime cost multiplier. |
| `enable_reasoning` | Whether hybrid reasoning behavior may be enabled. |
| `reasoning_effort` | Default reasoning effort. |
| `static_tools` | Built-in toolkits such as `duckduckgo`, `yfinance`, or `calculator`. |
| `suggestions` | Suggested starter prompts synced as `ServiceSuggestion` rows. |
| `default_open_canvases` | Canvas component keys to associate with the agent. |
| `extra_config` | Frontend UI config such as canvas width, input requirements, and allowed file types. |

## Demo Config

`DemoConfigDef` is serialized to the `AgentService.demo_config` JSON field.

| Field | Values | Purpose |
| --- | --- | --- |
| `access_mode` | `ALLOWED`, `BLOCKED` | Whether demo access can start at all. |
| `model_override` | model id or `None` | Runtime model used for demo mode. |
| `message_limit_scope` | `SESSION`, `DAILY`, `TOTAL`, `NONE` | How message limits are counted. |
| `message_limit_count` | integer | Allowed demo messages. |
| `canvas_mode` | `HIDDEN`, `LOCKED`, `OPEN` | Canvas behavior when the user lacks full access. |
| `canvas_placeholder_text` | string | Lock/upgrade copy for the frontend. |

## Current Definition Files

Agent files are auto-discovered from `backend/definitions/agents`. Current definition modules include:

- `expert.py`
- `visitor.py`
- `general-doctor.py`
- `ravansanj.py`
- `ravanyar.py`
- `ravanyar-motekhases.py`
- `supervisor-mashaghel.py`
- `tarahi-darman.py`
- `tarahi-jalasat-darman.py`
- `tarahi-jalasat-daro-darman.py`
- `tarahi-jalasat-ravan-darman.py`
- `tashkil-parvande.py`
- `vakil.py`
- `fal.py`
- `HAM-edalat.py`
- `HAM-moraje.py`
- `HAM-motalee.py`
- `HAM-shoghli.py`
- `HAM-tahsili.py`

Each module should export `AGENTS = [AgentDef(...)]` when possible.

## Frontend Config

`extra_config` is passed through service serialization as `ui_config` and `input_requirements`.

Common keys:

- `has_canvas`
- `default_width`
- `show_voice_input`
- `mobile_view_default`
- `allowed_file_types`
- `input_requirements.requires_context`
- `input_requirements.context_label`
- `input_requirements.context_provider_endpoint`
- `input_requirements.context_header`

## Rules

- Keep agent audience accurate.
- Use capabilities for behavior instead of embedding domain logic directly in agent definitions.
- Keep demo behavior deliberate.
- Keep canvas defaults aligned with supported capability canvases.
- Keep `slug` stable. Renaming a slug affects URLs, sessions, billing plan references, and access checks.
- Keep product-facing `name`, `description`, `user_guide`, and suggestions in Persian unless the product intentionally changes language.
- Keep contributor comments and docs in English.

## Adding an Agent

1. Create or update a module under `backend/definitions/agents`.
2. Export `AGENTS = [AgentDef(...)]`.
3. Choose the correct `audience`.
4. Set `eligible_expert_professions` for expert-only agents when profession filtering matters.
5. Attach capability domains instead of copying tool logic into the prompt.
6. Add default canvases only when a matching capability and frontend renderer exist.
7. Define demo behavior explicitly.
8. Add plan access in billing definitions if the agent is not free.
9. Run backend definition sync.
10. Verify service discovery and runtime access with the intended role.

## Retiring an Agent

Prefer setting `is_active=False` when the runtime should stop serving the agent. Use `is_public=False` when it should be hidden from discovery but may still need compatibility for old sessions or internal links.

Do not delete a definition or rename its slug without a migration plan for existing sessions, billing plans, links, and frontend routes.

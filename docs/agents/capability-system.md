# Capability System

Capabilities are the backend extension mechanism for agent behavior. They let agents load domain-specific tools, prompt additions, canvas types, context prompts, form handlers, and initial canvas state without hardcoding domain logic into route handlers or agent definitions.

## Key Paths

- `backend/capabilities`
- `backend/capabilities/registry.py`
- `backend/capabilities/base.py`
- `backend/agents/factory.py`
- `backend/services/apps.py`
- `backend/services/management/commands/sync.py`

## Base Interfaces

`backend/capabilities/base.py` defines three extension interfaces.

| Interface | Purpose |
| --- | --- |
| `BaseCapability` | Runtime domain hook for tools, prompt additions, canvases, context, and initial state. |
| `BaseCanvas` | Code-defined canvas metadata, default state, and schema. |
| `BaseFormHandler` | Backend handler for structured form submissions. |

## Registry Decorators

`CapabilityRegistry` exposes decorators and shortcuts:

| Decorator | Registers |
| --- | --- |
| `@register_capability("domain")` | A `BaseCapability` implementation under a domain key. |
| `@register_canvas` | A `BaseCanvas` class by `component_key`. |
| `@register_form_handler` | A `BaseFormHandler` class by `get_id()`. |

`register_tool` is a compatibility alias for `register_capability`.

## Registry Storage

The registry keeps three in-memory maps:

- `_domain_capabilities`: domain key to capability instances.
- `_canvases`: canvas `component_key` to canvas class.
- `_form_handlers`: handler ID to form handler class.

These maps are populated by importing modules under `backend/capabilities`.

## Autodiscovery

`CapabilityRegistry.autodiscover()` walks the `capabilities` package and imports modules so decorators run.

Autodiscovery runs:

- during Django app startup in `services.apps.ServicesConfig.ready`
- during `python manage.py sync` before syncing canvas definitions

Decorator code must be import-safe. Avoid database queries or environment-dependent side effects at module import time.

## Current Domains

- `core`
- `vania_visitor`
- `vania_expert`

## Runtime Use

At agent creation time, `backend/agents/factory.py`:

1. Resolves active capability domains from `AgentService.capabilities`.
2. Loads capability canvases and initial state.
3. Gets static and custom service tools.
4. Adds global profile tools.
5. Adds capability tools.
6. Adds capability prompt additions.
7. Adds resource-specific context when `X-Target-Resource-ID` is present.

## Capability Hooks

`BaseCapability` supports:

| Hook | Purpose |
| --- | --- |
| `get_tools(user, session_id)` | Return Agno tools for this user/session. |
| `get_system_prompt_additions(user)` | Add general instructions for the domain. |
| `get_default_canvases()` | Return canvas component keys to hydrate. |
| `on_agent_start(user, session_id)` | Reserved lifecycle hook. |
| `get_context_prompt(user, resource_id)` | Add resource-specific prompt context. |
| `get_initial_canvas_state(user, session_id, resource_id, canvas_key)` | Provide initial canvas state. |

## Rules

- Put domain behavior in capabilities.
- Keep hooks narrow and domain-specific.
- Make registration discoverable and idempotent.
- Keep backend canvas registration aligned with frontend renderers.
- Validate permissions inside tools and form handlers, not only in prompts.
- Return structured data where the frontend or canvas needs to update state.
- Keep capability prompts explicit about available tool contracts and forbidden invented payloads.
- Do not use capability code to bypass role, profession, billing, or resource ownership rules.

## Adding a Capability Domain

1. Create `backend/capabilities/<domain>/`.
2. Add a `capability.py` with `@register_capability("<domain>")`.
3. Add tools, canvases, forms, and handlers as separate modules when useful.
4. Ensure the package imports cleanly during autodiscovery.
5. Add the domain key to one or more `AgentDef.capabilities`.
6. Add frontend canvas renderers if the capability registers canvases.
7. Run sync so canvases and agent service metadata are updated.

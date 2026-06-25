# Capabilities

Capabilities are the backend extension mechanism that lets agents gain tools, canvas support, form handlers, prompt additions, and resource-specific context.

## Key Files

| File | Purpose |
| --- | --- |
| `backend/capabilities/base.py` | Base capability, canvas, and form handler contracts |
| `backend/capabilities/registry.py` | Registration and lookup registry |
| `backend/capabilities/core` | Core/shared capability behavior |
| `backend/capabilities/vania_visitor` | Visitor-facing Vania capability |
| `backend/capabilities/vania_expert` | Expert-facing Vania capability |

## Registry

`CapabilityRegistry` stores:

- canvas classes by `component_key`
- form handlers by handler id
- instantiated capability classes by domain

Decorators:

- `@register_capability("domain")`
- `@register_canvas`
- `@register_form_handler`

## Capability Contract

`BaseCapability` can implement:

- `get_tools(user, session_id)`
- `get_system_prompt_additions(user)`
- `get_default_canvases()`
- `on_agent_start(user, session_id)`
- `get_context_prompt(user, resource_id)`
- `get_initial_canvas_state(user, session_id, resource_id, canvas_key)`

## Canvas Contract

`BaseCanvas` defines:

- `component_key`
- `name`
- `slug`
- `description`
- `get_default_state()`
- `get_schema()`

Canvas classes sync into `CanvasType` records. Their `component_key` must match frontend renderer resolution.

## Form Handler Contract

`BaseFormHandler` defines:

- `get_id()`
- `process(user, data, session_id, resource_id)`

Form handlers are executed through `/api/services/forms/submit/`.

## Runtime Integration

Capabilities are used by:

- service discovery and debug context
- agent factory tool injection
- agent factory prompt additions
- agent factory and canvas route initial canvas hydration
- canvas refresh tools
- form submission endpoint

## Current Domains

| Domain | Purpose |
| --- | --- |
| `core` | Shared tool/form behavior |
| `vania_visitor` | Visitor/patient journey canvas and tools |
| `vania_expert` | Expert patient manager canvas, case/profile tools, forms |

## Backend Rules

- Put domain-specific agent behavior in capabilities, not in generic routes.
- Keep tool and form inputs structured.
- Check resource permissions before mutating data.
- Prefer domain services for durable persistence.
- Emit `CanvasUpdateEvent` after state-changing tools when the frontend canvas should refresh.

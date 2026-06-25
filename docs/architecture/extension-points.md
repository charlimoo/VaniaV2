# Extension Points

Vania is designed to be extended through code-defined definitions and capability domains.

## Agent Definitions

Add or change agent metadata in:

- `backend/definitions/agents`
- `backend/definitions/base.py`

Definitions sync into:

- `services.AgentService`
- `services.ServiceSuggestion`
- `services.AgentCanvasConfig`

Agent definitions should describe:

- Identity and copy.
- Model configuration.
- Audience and profession eligibility.
- Demo behavior.
- Capability domains.
- Default canvases.
- UI configuration.

## Capability Domains

Add domain behavior under:

- `backend/capabilities/<domain>`

Capabilities can provide:

- Tools.
- Canvas registrations.
- Form handlers.
- System prompt additions.
- Resource-specific context.
- Initial canvas state.

Registry file:

- `backend/capabilities/registry.py`

Base contracts:

- `backend/capabilities/base.py`

## Canvas Types

Canvas registration starts in backend capability code and must end in a frontend renderer.

```text
@register_canvas class
  -> CapabilityRegistry._canvases
  -> CanvasType sync
  -> AgentCanvasConfig sync
  -> /agent/canvas/state hydration
  -> frontend CanvasRegistry component_key mapping
```

Frontend registry:

- `frontend/components/canvas/CanvasRegistry.tsx`

## Tools

Agent tools can come from several places:

- Static built-in tools listed on `AgentService.static_tools`.
- Custom DB-backed tools through `AvailableTool`.
- Global profile tools.
- Capability-provided dynamic tools.

Assembly point:

- `backend/agents/factory.py`

Rules:

- Validate tool inputs.
- Check user role and resource permissions.
- Persist durable state through domain services.
- Emit canvas update events when UI state must refresh during the run.

## Forms

Capability form handlers are registered in the capability registry and executed through:

- `POST /api/services/forms/submit/`
- `backend/services/views.py`

Rules:

- The handler key is part of the frontend/backend contract.
- Form handlers should return structured results.
- Resource context can come from `X-Target-Resource-ID` or request body `resource_id`.

## Definition Sync

Sync is the bridge between code definitions and runtime database records.

Important file:

- `backend/definitions/sync.py`

Sync currently covers:

- Admin bootstrap user.
- Billing config.
- FAQs.
- Agents.
- Locations.
- Expert professions.
- Plans and products.
- Discounts.

Rules:

- Keep sync idempotent.
- Do not rename stable slugs or component keys casually.
- When adding definitions, verify the runtime records and frontend service discovery response.

# Service Access

Service access is enforced in both service discovery and runtime agent creation.

## Key Paths

- `backend/services/views.py`
- `backend/services/serializers.py`
- `backend/services/access_service.py`
- `backend/agents/routes.py`
- `backend/agents/factory.py`
- `backend/definitions/agents`

## Definition Inputs

Agent definitions control:

- `is_free`
- `audience`
- `eligible_expert_professions`
- `requires_visitor_selector`
- `is_public`
- `is_active`
- `demo_config`
- `default_open_canvases`
- `extra_config`

These sync to `AgentService`.

## Discovery Access

`ServiceListView`:

1. filters active services
2. filters non-staff users to public services
3. filters by `is_user_eligible_for_agent`
4. serializes access and UI metadata

Staff/admin users can see all active services.

## Serialized Access Fields

`ServiceSerializer` exposes:

- `is_owned`
- `access_status`
- `audience`
- `eligible_expert_professions`
- `requires_visitor_selector`
- `capabilities`
- `ui_config`
- `supported_canvases`
- `input_requirements`
- `demo_config`
- `current_usage`

`access_status` can be `FREE`, `OWNED`, `LOCKED`, or `MAINTENANCE`.

## Runtime Access

`AccessControlService` checks runtime permission. `backend/agents/factory.py` calls it before building the runtime agent.

If the user lacks full access, runtime can enter demo mode depending on the agent's `demo_config`.

## Visitor Selector Requirement

`requires_visitor_selector=True` is a frontend/runtime hint for expert agents that need selected visitor/case context.

Backend tools must still handle missing visitor/case context by browsing accessible resources, returning a clear error, or refusing the action safely.

## Debug Prompt Endpoint

`ServiceDebugContextView` exposes prompt/context layers for a service. It checks service existence and agent eligibility before returning debug context.

Use it to inspect shared prompt, static prompt, capability prompt, runtime injected context, and selected visitor/expert/case sources.

## Service Access Checklist

When adding or changing an agent:

- set the correct `audience`
- set profession constraints for expert agents
- set `is_free` and billing plan inclusion consistently
- decide whether it needs visitor selector context
- run definition sync
- test service discovery as visitor, verified expert, wrong-profession expert, unverified expert, and staff/admin
- test runtime access separately from discovery

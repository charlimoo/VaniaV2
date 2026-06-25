# Runtime Hooks

Capability hooks are called by the agent factory and related service endpoints to assemble prompt context, tools, and canvas state.

## Active Capabilities

The runtime starts from `AgentService.capabilities`. `backend/agents/factory.py` also contains compatibility fallback logic for known visitor/expert agents that should have Vania context capabilities.

Do not rely on fallback maps for new agents. Add the correct capability domain in the `AgentDef`.

## Prompt Layers

Runtime prompt context is layered from:

1. shared culture/system prompt
2. agent `system_prompt`
3. default profile context
4. active frontend selections from session state
5. capability prompt additions
6. resource-specific capability context

`/api/services/<slug>/prompt-preview/` can expose these layers for debugging.

## General Capability Prompt

`get_system_prompt_additions(user)` returns domain instructions independent of one specific resource.

Use this hook for:

- tool contract rules
- domain vocabulary
- privacy constraints
- profession policy instructions
- preflight/read-before-write rules

Avoid stuffing transient session state into this hook. Use resource/session context for that.

## Resource Context Prompt

`get_context_prompt(user, resource_id)` runs when `X-Target-Resource-ID` is present.

Expert workflows usually treat `resource_id` as the selected visitor/patient ID. Visitor workflows may derive the active case/expert from session context and the authenticated user.

This hook should return compact, high-signal state. It must enforce access rules before exposing resource data.

## Initial Canvas State

`get_initial_canvas_state(user, session_id, resource_id, canvas_key)` can provide first-load state for a canvas instance.

Return `None` when the capability does not own the requested canvas. The factory falls back to `CanvasType.default_state`.

## Tool Hook

`get_tools(user, session_id)` returns tool functions or toolkits for the active capability.

This hook can filter tools by:

- user role
- expert profession
- active case policy
- feature family availability

Filtering tools is useful UX and model guidance, but each tool must still validate permissions internally.

## Default Canvas Hook

`get_default_canvases()` returns canvas component keys owned by the capability. The factory hydrates these into `CanvasInstance` rows for the active session.

Keep this list aligned with:

- registered backend `BaseCanvas` classes
- `AgentDef.default_open_canvases`
- frontend `CanvasRegistry`

## Hook Failure Rules

The registry catches and logs hook failures so one capability error does not always crash the entire chat. Do not use this as a substitute for validation.

Hooks should:

- return empty values when not applicable
- log enough context for debugging
- avoid mutating persistent state unless the hook explicitly owns hydration
- keep expensive work bounded

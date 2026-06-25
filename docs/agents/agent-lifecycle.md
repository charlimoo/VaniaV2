# Agent Lifecycle

An agent moves through a code-first lifecycle: definition, sync, service discovery, frontend selection, runtime construction, streaming, and persistence.

## Lifecycle Overview

```text
AgentDef
  -> discover_agents()
  -> DefinitionSync.sync_agents()
  -> AgentService + ServiceSuggestion + AgentCanvasConfig rows
  -> /api/services/ discovery
  -> frontend chat route
  -> create_agent_for_service()
  -> ServiceAgent runtime
  -> AG-UI stream + canvas/session persistence
```

## Definition Stage

Definitions live in `backend/definitions/agents`. They describe who the agent is, who can use it, which model it uses, which capabilities it loads, which canvases it opens, and how demo mode behaves.

This is the right layer for:

- agent identity and prompt
- role/audience targeting
- expert profession eligibility
- static tools
- capability domain list
- suggestions
- default canvas keys
- UI config hints

This is not the right layer for domain business logic. Put that in capabilities or Vania domain services.

## Sync Stage

`DefinitionSync.sync_agents()` writes each `AgentDef` into `AgentService`. It also recreates synced suggestions and associates default canvases through `AgentCanvasConfig`.

Run:

```bash
cd backend
python manage.py sync
```

The sync command also autodiscovers capabilities and syncs registered canvas types.

## Discovery Stage

The frontend discovers services through `/api/services/`. `ServiceSerializer` returns access state, role/profession metadata, suggestions, UI config, supported canvases, demo config, and current demo usage.

Frontend discovery is not security. Runtime access is checked again before the agent is created.

## Runtime Stage

`create_agent_for_service()` in `backend/agents/factory.py`:

1. Loads active `AgentService`.
2. Checks paid/free/demo access.
3. Applies demo model override when needed.
4. Resolves active capabilities.
5. Hydrates capability canvases.
6. Creates the Agno storage adapter.
7. Adds static, custom, global, and capability tools.
8. Builds profile, selection, capability, and resource prompt context.
9. Applies reasoning/model settings.
10. Instantiates `ServiceAgent`.

## Stream Stage

The frontend sends a run to `/agent/agui?agent_id=<slug>`. The backend emits AG-UI events for text, tool calls, custom events, canvas updates, errors, and run lifecycle.

Canvas updates and session renames are custom events consumed by frontend runtime hooks.

## Persistence Stage

Relevant persisted state includes:

- `AgentService`
- `ServiceSuggestion`
- `AgentCanvasConfig`
- `CanvasType`
- `CanvasInstance`
- agent session history
- session metadata/context
- domain state in Vania services/models

Agent code should assume session context and canvas state can be restored after refresh.

## Lifecycle Change Checklist

When changing an agent lifecycle path:

- update the code-first definition first
- run sync after definition/canvas changes
- verify service discovery returns expected metadata
- verify runtime access independently from frontend visibility
- verify capability tools and canvases load
- verify old sessions still resolve when slug or canvas behavior changes

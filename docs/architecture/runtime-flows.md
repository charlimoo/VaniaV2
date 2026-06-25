# Runtime Flows

This page documents the important request and state flows in Vania.

## Service Discovery

Service discovery determines which agents the user can see and how the frontend should render them.

```text
Frontend dashboard or chat shell
  -> GET /api/services/
  -> ServiceListView
  -> AgentService query
  -> role/profession eligibility filter
  -> ServiceSerializer
  -> frontend agent grid, agent switcher, chat workspace
```

Important backend files:

- `backend/services/views.py`
- `backend/services/serializers.py`
- `backend/users/eligibility.py`
- `backend/services/access_service.py`

Important behavior:

- Staff and admins can see active services regardless of normal marketplace restrictions.
- Non-staff users only see active public services for which they are role/profession eligible.
- `ServiceSerializer` returns `access_status`, `is_owned`, `demo_config`, `ui_config`, and `supported_canvases`.
- Frontend hiding is presentation only. Runtime access is checked again before agent execution.

## Chat Session Flow

1. The frontend opens a chat route with `agentId` and `threadId`.
2. Query params preserve visitor/patient, expert/doctor, and case context.
3. The frontend creates or restores the session through `/agent/sessions`.
4. The frontend sends a run to `/agent/agui?agent_id=<slug>`.
5. FastAPI middleware authenticates the Django JWT and extracts context headers.
6. The runtime checks paid access or demo limits.
7. `create_agent_for_service` builds a `ServiceAgent` from the synced `AgentService`.
8. The stream generator runs the agent through Agno and emits AG-UI events.
9. The frontend receives text, tool, custom, error, and run lifecycle events.

Important backend files:

- `backend/agents/routes.py`
- `backend/agents/middleware.py`
- `backend/agents/factory.py`
- `backend/agents/stream.py`
- `backend/agents/storage.py`

Important frontend files:

- `frontend/app/(chat)/chat/[agentId]/[threadId]/page.tsx`
- `frontend/lib/SimpleThreadAdapters.ts`
- `frontend/lib/canvas/useCanvasSync.ts`

## Agent Construction Flow

`create_agent_for_service` is the main runtime assembly point.

```text
AgentService slug
  -> fetch active service
  -> check access and demo model override
  -> resolve active capabilities
  -> hydrate default canvas instances
  -> create Agno storage adapter
  -> collect static, custom, global, and capability tools
  -> build profile, selection, capability, and resource context
  -> initialize model, reasoning, RAG, summaries
  -> instantiate ServiceAgent
```

The factory combines persisted service metadata with runtime state. This is why changes to agent definitions, capability registration, access rules, and context headers can all affect the same chat run.

## Canvas State Flow

1. Agent/capability definitions register supported canvas types.
2. Definitions sync writes canvas metadata to the database.
3. Runtime endpoints hydrate canvas instances for a thread/resource context.
4. The frontend canvas registry maps backend `component_key` values to renderer modules.
5. Canvas updates persist through backend canvas models and sync APIs.

## Canvas Hydration Flow

```text
Chat page or dashboard journey page
  -> GET /agent/canvas/state/{session_id}?agent_id=<slug>
  -> FastAPI context middleware
  -> fetch existing CanvasInstance rows
  -> rehydrate if missing or stale
  -> CapabilityRegistry.get_initial_state_for_domains(...)
  -> CanvasInstance update_or_create
  -> frontend canvas store
```

Hydration can be triggered when:

- No canvas instances exist for the session.
- The active patient/visitor changed.
- The active expert/doctor or case changed.
- Existing patient manager or patient journey state is inactive, empty, or stale.
- Shared base profile state differs from the canonical persisted profile.

## Canvas Update Flow

Agent-originated updates:

```text
Capability tool
  -> persists domain or canvas state
  -> yields CanvasUpdateEvent(name="CANVAS_UPDATE")
  -> agui_stream_generator wraps it as AG-UI CUSTOM event
  -> useCanvasSync receives event
  -> useCanvasStore.updateCanvas(..., source="AGENT")
```

User-originated updates:

```text
Renderer user action
  -> useCanvasStore.updateCanvas(..., source="USER")
  -> PATCH /agent/canvas/instance/{id}
  -> canvas route persists permanent domain changes when needed
  -> CanvasManager merges JSON state transactionally
```

## Form Submission Flow

```text
Frontend form renderer
  -> POST /api/services/forms/submit/
  -> SubmitFormView
  -> CapabilityRegistry.get_handler(handler_key)
  -> handler.process(user, data, session_id, resource_id)
  -> structured result
```

Form handlers are code-defined capability extension points. They should validate backend-side, enforce resource permissions, and return structured results.

## Attachment Flow

```text
Frontend attachment picker
  -> POST /agent/attachments/prepare
  -> validate file type and size
  -> create session if needed
  -> ingest PDF into session knowledge when applicable
  -> persist UI attachment metadata during stream
  -> agent receives retrieved file context when needed
```

Images are sent as multimodal input. PDFs are prepared through session-level knowledge ingestion so the agent can search thread attachments.

## Session Naming Flow

The stream generator schedules non-blocking title generation:

- Once near the beginning of a run, based on the first user message.
- Again after the run persists messages, so a generic initial title can be replaced.

This work must never block the streaming response.

## Failure and Recovery Rules

- Runtime access failures should return explicit `403` or billing/demo errors.
- Stream disconnects should cancel the agent task and mark the run cancelled when possible.
- Canvas hydration failures should log and return existing canvas state instead of breaking the chat page.
- Canvas update failures should surface as failed PATCH requests and avoid silently pretending persistence succeeded.
- Missing canvas definitions usually mean definitions/capability sync has not run.

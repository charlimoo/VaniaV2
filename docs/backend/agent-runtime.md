# Agent Runtime

The agent runtime is the FastAPI application mounted at `/agent`. It connects frontend chat sessions to synced `AgentService` records, Agno agents, capabilities, tools, context headers, RAG, canvas state, billing/demo rules, and AG-UI streaming.

## Runtime App

Important files:

- `backend/core/asgi.py`: mounts FastAPI at `/agent`.
- `backend/agents/app.py`: creates the FastAPI app, applies middleware, includes agent and canvas routers.
- `backend/agents/middleware.py`: decodes Django JWTs and sets runtime context variables.
- `backend/agents/routes.py`: session, streaming, attachments, transcription, cancellation, share endpoints.
- `backend/canvas/routes.py`: canvas hydration and canvas instance PATCH endpoints.

## Route Groups

| Route | Purpose |
| --- | --- |
| `GET /agent/sessions` | List authenticated user's agent sessions |
| `GET /agent/sessions/{session_id}` | Read chat history and normalized session state |
| `POST /agent/sessions` | Create a session record |
| `PATCH /agent/sessions/{session_id}` | Rename/update session metadata |
| `DELETE /agent/sessions/{session_id}` | Delete a session |
| `POST /agent/agui?agent_id=<slug>` | Start an AG-UI streaming run |
| `POST /agent/runs/{run_id}/cancel` | Cancel a run |
| `POST /agent/transcribe` | Transcribe audio and charge credits |
| `POST /agent/attachments/prepare` | Validate and prepare image/PDF attachments |
| `DELETE /agent/attachments/{attachment_id}` | Remove prepared session attachment knowledge |
| `POST /agent/share/{session_id}` | Create a public share link |
| `GET /agent/share/{token}` | Public read-only shared chat fetch |
| `GET /agent/canvas/state/{session_id}` | Hydrate canvas instances |
| `PATCH /agent/canvas/instance/{instance_id}` | Persist user canvas edits |

## Agent Factory

`backend/agents/factory.py` is the runtime assembly point.

It performs:

1. Fetch `AgentService` by slug.
2. Check access and demo model override.
3. Resolve active capability domains.
4. Hydrate capability canvases into `CanvasInstance`.
5. Select Agno storage adapter.
6. Collect static, custom, global, and capability tools.
7. Build profile, session selection, capability, and resource context.
8. Configure model, reasoning, RAG, and session summaries.
9. Instantiate `ServiceAgent`.

## Streaming Pipeline

`backend/agents/stream.py` converts Agno streaming output into AG-UI events.

Important event categories:

- `RUN_STARTED`
- `TEXT_MESSAGE_START`
- `TEXT_MESSAGE_CONTENT`
- `TEXT_MESSAGE_END`
- `TOOL_CALL_START`
- `TOOL_CALL_ARGS`
- `TOOL_CALL_RESULT`
- `TOOL_CALL_END`
- `CUSTOM`
- `RUN_ERROR`
- `RUN_FINISHED`

Important custom events:

- `CANVAS_UPDATE`
- `SESSION_RENAME`
- `assistant_output_complete`
- `billing_required`

## Session Storage

The runtime uses `backend/agents/storage.py` to create a cached Agno storage adapter:

- SQLite when `DATABASE_CONNECTION_STRING` contains sqlite.
- Postgres otherwise.

`get_session_safe` must be used for user-owned session reads because it verifies the stored session `user_id`.

## Context Headers

Runtime requests may carry scoped context through:

- `X-Target-Resource-ID`
- `X-Target-Visitor-ID`
- `X-Target-Patient-ID`
- `X-Target-Expert-ID`
- `X-Target-Doctor-ID`
- `X-Target-Case-ID`
- `X-Active-Role`

Keep compatibility with both visitor/patient and expert/doctor naming.

## Runtime Access

`POST /agent/agui` checks access before creating the agent. If full access is missing, demo limits are checked through `services.usage.demo_usage_service`. Demo usage is incremented after successful runs.

## Failure Rules

- Missing/inactive service slugs return runtime errors.
- Permission failures should return `403`.
- Client disconnects cancel the agent task and attempt to mark the run cancelled.
- Attachment validation rejects unsupported types or files larger than the configured limit.
- Canvas hydration errors should log and return existing state rather than taking down chat.

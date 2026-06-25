# Agent APIs

Agent APIs live under the FastAPI runtime mounted at:

```text
/agent/
```

They power chat sessions, AG-UI streaming, attachments, transcription, cancellation, and public sharing.

## Endpoint Table

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/agent/sessions` | Bearer | List the authenticated user's sessions. |
| `GET` | `/agent/sessions/{session_id}` | Bearer | Get chat history and normalized session state. |
| `POST` | `/agent/sessions` | Bearer | Create a session record. |
| `PATCH` | `/agent/sessions/{session_id}` | Bearer | Rename/update session metadata. |
| `DELETE` | `/agent/sessions/{session_id}` | Bearer | Delete a session. |
| `POST` | `/agent/agui?agent_id=<slug>` | Bearer | Start AG-UI streaming run. |
| `POST` | `/agent/runs/{run_id}/cancel` | Bearer | Cancel a run. |
| `POST` | `/agent/transcribe` | Bearer | Transcribe audio and charge credits. |
| `POST` | `/agent/attachments/prepare` | Bearer | Validate/process image or PDF attachment. |
| `DELETE` | `/agent/attachments/{attachment_id}?thread_id=...` | Bearer | Remove prepared attachment knowledge. |
| `POST` | `/agent/share/{session_id}` | Bearer | Create public read-only share link. |
| `GET` | `/agent/share/{token}` | Public | Read public shared chat. |

## Session State

Session state preserves role/context aliases:

- `visitor_id` / `patient_id`
- `visitor_name` / `patient_name`
- `selected_expert_id` / `selected_doctor_id`
- `selected_expert_name` / `selected_doctor_name`
- `selected_case_id`
- `selected_case_title`
- `selected_case_doctor_name`
- `selected_case_doctor_profession_slug`
- `selected_case_doctor_profession_label`

Do not remove aliases without migrating frontend, backend, and stored sessions.

## Create Session

`POST /agent/sessions` accepts:

```json
{
  "session_id": "local-or-persisted-id",
  "session_name": "New Conversation",
  "session_state": {
    "agent_id": "vania-expert-assistant"
  }
}
```

Response is usually `{ "status": "created" }` or `{ "status": "exists" }`.

## AG-UI Stream

`POST /agent/agui?agent_id=<slug>` accepts AG-UI `RunAgentInput`.

Runtime behavior:

1. checks service existence
2. checks full access or demo limits
3. restores/persists branch history when needed
4. builds the service agent
5. streams AG-UI events as `text/event-stream`

Important event categories:

- run lifecycle
- text message start/content/end
- tool call events
- custom events
- errors

Important custom events:

- `CANVAS_UPDATE`
- `SESSION_RENAME`
- `assistant_output_complete`
- `billing_required`

## Attachments

`POST /agent/attachments/prepare` is multipart form data:

- `thread_id`
- `agent_id`
- `attachment_id`
- `file`

Images are validated and returned as prepared metadata. PDFs are ingested into session knowledge. Unsupported or oversized files return `400`.

`DELETE /agent/attachments/{attachment_id}?thread_id=...` removes prepared session file knowledge.

## Transcription

`POST /agent/transcribe` accepts audio file upload. It transcribes Persian audio, calculates service charge, deducts credits, and returns:

```json
{
  "text": "...",
  "duration": 12.3,
  "cost": 2.05
}
```

Insufficient credits return `402`.

## Sharing

`POST /agent/share/{session_id}` verifies ownership and returns:

```json
{
  "share_id": "...",
  "url": "/share/..."
}
```

`GET /agent/share/{token}` is public and returns sanitized read-only chat history.

## Frontend Consumers

- `frontend/lib/ag-ui`
- `frontend/lib/SimpleThreadAdapters.ts`
- `frontend/lib/canvas/useCanvasSync.ts`
- chat page and public share page

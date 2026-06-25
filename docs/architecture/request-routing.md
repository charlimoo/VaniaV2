# Request Routing

Vania uses Starlette ASGI mounting to route requests to either FastAPI or Django.

## ASGI Mount Order

`backend/core/asgi.py` mounts apps in this order:

1. `/agent` -> FastAPI agent runtime.
2. Static files when configured.
3. Media files in local mode.
4. `/` -> Django catch-all.

This means `/agent/...` never reaches Django URL routing. `/api/...` reaches Django.

## Backend Route Map

```text
/agent
  /sessions
  /agui
  /runs/{run_id}/cancel
  /attachments/prepare
  /attachments/{attachment_id}
  /share/{session_id}
  /canvas/state/{session_id}
  /canvas/instance/{instance_id}

/api
  /auth
  /billing
  /services
  /vania
```

## Frontend API Configuration

The frontend uses `NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:8000`.

Important file:

- `frontend/lib/api.ts`

The same base URL is used for both Django and FastAPI paths:

- `${API_BASE_URL}/api/services/`
- `${API_BASE_URL}/agent/agui`
- `${API_BASE_URL}/agent/canvas/state/{threadId}`

## Authentication Routing

Django APIs use DRF/SimpleJWT authentication.

FastAPI runtime routes use custom middleware:

- `backend/agents/middleware.py`

The FastAPI middleware:

- Reads `Authorization: Bearer <token>`.
- Decodes the Django SimpleJWT token.
- Loads `CustomUser`.
- Sets context variables for user, role, resource, expert/doctor, and case.
- Resets context variables after the request.

Public share fetches are intentionally allowed without auth.

## Request Debugging Checklist

1. Check whether the path starts with `/agent` or `/api`.
2. For `/agent`, inspect FastAPI route handlers and middleware.
3. For `/api`, inspect Django `urls.py`, DRF views, and middleware.
4. Confirm the frontend uses `API_BASE_URL`, not a hard-coded origin.
5. Confirm context headers are present when the request needs scoped visitor, expert, or case data.

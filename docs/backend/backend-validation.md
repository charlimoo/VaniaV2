# Backend Validation

Use this page when validating backend changes before handoff.

## Standard Commands

From `backend/`:

```bash
venv\Scripts\activate
python manage.py check
python manage.py migrate
pytest
```

Run targeted tests when the touched area is narrow. Run broader tests when changing access, runtime, canvas, billing, auth, or domain services.

## High-Risk Areas

- Authentication and OTP.
- Role and expert profession eligibility.
- Service discovery.
- Access cache and billing plan changes.
- Agent runtime streaming.
- Session metadata and alias normalization.
- Canvas hydration and PATCH persistence.
- Capability tools and form handlers.
- Domain service permissions.
- RAG ingestion and uploaded file handling.
- Payment callback idempotency.

## Manual API Checks

Useful checks after backend changes:

- `GET /api/auth/profile/`
- `GET /api/services/`
- `GET /api/services/debug-context/<agent-slug>/?session_id=<id>`
- `POST /agent/sessions`
- `GET /agent/sessions/{session_id}`
- `POST /agent/agui?agent_id=<slug>`
- `GET /agent/canvas/state/{session_id}?agent_id=<slug>`
- `PATCH /agent/canvas/instance/{instance_id}`

Use the same context headers the frontend sends when testing scoped expert/visitor flows.

## Definition Changes

After changing definitions:

1. Run sync.
2. Check `/api/services/`.
3. Verify agent audience, professions, demo config, capabilities, and canvases.
4. Verify plan-to-agent access if the agent is paid.

## Model Changes

After changing models:

1. Create migrations.
2. Inspect migration operations.
3. Run migrations locally.
4. Check serializers and admin usage.
5. Add or update tests for access and data lifecycle.

## Runtime Changes

After changing agent runtime:

- Test a normal text response.
- Test a tool call.
- Test cancellation/disconnect behavior if streaming loop changed.
- Test a run with active visitor/expert/case context.
- Test demo/locked access if access logic changed.

## Canvas Changes

After changing canvas backend:

- Run canvas hydration for a fresh thread.
- Run hydration after changing active visitor/case.
- Patch an existing canvas instance.
- Verify durable domain state is updated if the delta contains domain fields.
- Verify frontend renderer still resolves the `component_key`.

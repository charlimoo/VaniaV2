# Service APIs

Service APIs expose synced agent metadata to the frontend and provide capability-backed form submission.

Base path:

```text
/api/services/
```

## Endpoint Table

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/services/` | Bearer | List active, visible, eligible agent services. |
| `GET` | `/api/services/debug-context/<slug>/` | Bearer | Inspect prompt/context layers for a service. |
| `POST` | `/api/services/forms/submit/` | Bearer | Submit a capability-defined form handler. |

## Service Discovery

`GET /api/services/` returns services filtered by:

- active state
- public state for non-staff users
- role/profession eligibility
- active plan ownership for `is_owned` and `access_status`

Staff/admin users can see all active services.

## Service Response Fields

Important fields:

- `id`
- `name`
- `slug`
- `description`
- `system_prompt`
- `is_free`
- `is_owned`
- `access_status`
- `audience`
- `eligible_expert_professions`
- `requires_visitor_selector`
- `cost_multiplier`
- `is_public`
- `is_active`
- `tags`
- `suggestions`
- `model_id`
- `user_guide`
- `reasoning_type`
- `capabilities`
- `enable_reasoning`
- `reasoning_effort`
- `ui_config`
- `supported_canvases`
- `input_requirements`
- `demo_config`
- `current_usage`

`access_status` can be `FREE`, `OWNED`, `LOCKED`, or `MAINTENANCE`.

## Prompt Debug

`GET /api/services/debug-context/<slug>/` accepts optional context through query params or headers:

- `session_id`
- `resource_id`
- `visitor_id`
- `patient_id`
- `expert_id`
- `doctor_id`
- `case_id`

It returns prompt layers:

- shared prompt
- static agent prompt
- capability prompt
- runtime injected context

Use this endpoint for debugging context composition, not as a public user-facing endpoint.

## Form Submission

`POST /api/services/forms/submit/` accepts:

```json
{
  "handler": "GenericFormHandler",
  "session_id": "thread-id",
  "resource_id": "optional-resource-id",
  "data": {}
}
```

Handler key can also be provided as `form_handle` or `definition.handler` for compatibility.

Responses:

- `200`: `{ "status": "success", "result": ... }`
- `400`: missing handler or validation error
- `404`: handler not registered
- `500`: handler execution error

## Frontend Consumers

- dashboard agent discovery
- chat service metadata loading
- dynamic form surfaces
- prompt/debug tooling

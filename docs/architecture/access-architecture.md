# Access Architecture

Access control is backend-owned. The frontend can hide, lock, or guide, but it is not the source of truth.

## Access Inputs

Agent access depends on:

- User active status.
- Staff/admin status.
- User role.
- Expert verification status.
- Expert profession slug.
- Agent `audience`.
- Agent `eligible_expert_professions`.
- Agent `is_free`.
- User wallet active plan.
- Whether the active plan includes the agent.
- Demo configuration and usage limits.

## Eligibility

Role/profession eligibility is implemented in:

- `backend/users/eligibility.py`
- `backend/users/roles.py`

Rules:

- `ALL` audience is available to every eligible authenticated user.
- `VISITOR` audience is available to visitors and experts with visitor features.
- `EXPERT` audience requires expert role and verified expert status.
- `eligible_expert_professions` further restricts expert agents and plans.
- Staff/admin users bypass normal eligibility.

## Access Service

Paid/free agent permission is implemented in:

- `backend/services/access_service.py`

Flow:

```text
check_permission(user, agent_slug)
  -> cache lookup
  -> AgentService lookup
  -> active service check
  -> staff/admin bypass
  -> role/profession eligibility
  -> free agent check
  -> wallet active plan check
  -> included plan check
```

The result is cached per user and agent. Billing or plan changes should bump the user's access cache version.

## Service Discovery Access

`GET /api/services/` filters visible services before serialization.

Important behavior:

- Staff/admin sees active services.
- Non-staff users see active public services only.
- Role/profession eligibility is applied before serialization.
- `access_status` can be `FREE`, `OWNED`, `LOCKED`, or `MAINTENANCE`.

## Runtime Access

`POST /agent/agui` checks permission again before running the agent.

If the user does not have full access:

- Demo limits are checked.
- Demo model override may apply in the agent factory.
- Demo usage is incremented after a completed stream.
- Canvas behavior is controlled by the agent demo config and frontend UI.

## Rules

- Never add a feature that relies only on frontend hiding.
- Check role and profession rules before billing assumptions.
- Treat staff/admin bypass as a development/admin convenience, not product behavior.
- When adding a new paid agent, update definitions, plans, service discovery expectations, and runtime tests.

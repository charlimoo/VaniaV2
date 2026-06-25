# Eligibility

Eligibility determines which services, plans, features, and flows a user can access.

## Key Paths

- `backend/users/eligibility.py`
- `backend/services/views.py`
- `backend/services/access_service.py`
- `backend/billing/views.py`
- `backend/billing/services.py`
- `backend/definitions/agents`
- `backend/definitions/billing.py`

## Inputs

- User role
- Expert profession
- Expert verification status
- Agent audience and profession constraints
- Agent `is_active`, `is_public`, and `is_free`
- Visitor selector requirement
- Plan audience and profession constraints
- Billing and demo state
- Resource context
- Staff/admin status

## Agent Eligibility

`is_user_eligible_for_agent(user, agent)` enforces:

| Agent audience | Rule |
| --- | --- |
| `ALL` | Any non-staff user passes audience eligibility. |
| `VISITOR` | `visitor` and `expert` users pass. |
| `EXPERT` | User must be canonical `expert`, `is_expert_verified=True`, and match profession list when one exists. |

Staff/admin users are eligible for all agents.

## Plan Eligibility

`is_user_eligible_for_plan(user, plan)` is similar but stricter for visitor plans:

| Plan audience | Rule |
| --- | --- |
| `ALL` | Any non-staff user passes audience eligibility. |
| `VISITOR` | Only canonical `visitor` users pass. |
| `EXPERT` | User must be canonical `expert`, verified, and match profession list when one exists. |

This distinction is intentional: experts may use visitor-facing agents, but visitor storefront plans are not shown as expert plans.

## Service Discovery

`ServiceListView` returns active services. For non-staff users it also requires `is_public=True` and `is_user_eligible_for_agent(...)`.

The serializer then computes `is_owned`, `access_status`, `ui_config`, `supported_canvases`, `input_requirements`, `demo_config`, and `current_usage`.

## Runtime Permission

`AccessControlService.check_permission(user, agent_slug)` checks:

1. service exists
2. service is active
3. staff/admin bypass
4. role/profession eligibility
5. free agent access
6. wallet and active plan
7. agent included in active plan

The result is cached for five minutes. Plan fulfillment and expert-plan transfer bump the user's access cache version.

## Rules

- Enforce eligibility on the backend.
- Use frontend hiding only as presentation.
- Treat service discovery and runtime access as separate gates.
- Keep agent and plan profession lists aligned when a paid expert agent is added.
- Recheck eligibility after expert verification, plan purchase, and role/profession changes.

# Access and Demo Behavior

Agent access is controlled by role, profession, plan/free status, public/active flags, and demo configuration. Frontend visibility helps the user experience, but backend access is authoritative.

## Access Fields

Important `AgentDef` and `AgentService` fields:

| Field | Purpose |
| --- | --- |
| `is_free` | Grants access without a paid plan. |
| `is_public` | Controls normal discovery visibility. |
| `is_active` | Controls runtime availability. |
| `audience` | Limits to `ALL`, `VISITOR`, or `EXPERT`. |
| `eligible_expert_professions` | Limits expert agents to specific profession slugs. |
| `requires_visitor_selector` | Tells frontend to require visitor/case selection before expert use. |
| `plans` | Paid plan relation that unlocks non-free agents. |
| `demo_config` | Rules for users without full access. |

## Service Discovery

`/api/services/` returns visible services filtered by backend rules. `ServiceSerializer` includes:

- `is_owned`
- `access_status`
- `audience`
- `eligible_expert_professions`
- `requires_visitor_selector`
- `ui_config`
- `supported_canvases`
- `input_requirements`
- `demo_config`
- `current_usage`

Possible access statuses include:

- `FREE`
- `OWNED`
- `LOCKED`
- `MAINTENANCE`

## Runtime Access

`create_agent_for_service()` checks access again through the service access layer. If the user lacks full access, runtime enters demo mode when allowed.

Demo mode can:

- swap the model through `model_override`
- enforce message limits
- lock, hide, or open canvas UI depending on `canvas_mode`

Do not treat frontend access status as sufficient for runtime permission.

## Role and Profession

Expert profession rules matter. An agent with `audience="EXPERT"` can still be limited by `eligible_expert_professions`.

Profession policy also filters tool families and canvas/form/test visibility inside Vania capabilities. This means two experts may see the same agent but receive different available behavior.

## Visitor Selector

`requires_visitor_selector=True` tells the frontend that an expert must select visitor/case context before normal use.

Runtime tools should still handle missing visitor/case context gracefully by browsing accessible visitors/cases or returning a clear error.

## Demo Change Checklist

When changing access or demo behavior:

- verify service discovery for visitor, expert, staff/admin, and locked users
- verify runtime access independently
- verify demo usage count behavior
- verify model override
- verify canvas hidden/locked/open behavior
- verify billing upgrade paths still make sense
- update billing plan definitions if paid access changes

# Testing and Debugging

Agent and capability changes are high-risk because they cross definitions, sync, access, runtime prompts, tools, canvas state, and frontend rendering.

## Primary Checks

After changing agent definitions or capabilities:

```bash
cd backend
python manage.py sync
pytest
```

Run narrower tests when available for the specific domain you changed.

For frontend-visible changes:

```bash
cd frontend
pnpm exec tsc --noEmit
```

For docs changes:

```bash
cd docs
pnpm build
```

## Prompt Preview

Use the service prompt preview endpoint when debugging prompt composition. It shows:

- shared prompt layer
- static agent prompt
- capability prompt additions
- runtime injected profile/session/resource context
- source metadata such as capabilities and resource IDs

This is useful for checking whether the model receives the expected active visitor, case, profession policy, and tool rules.

## Runtime Logs

Useful runtime areas:

- `backend/agents/factory.py`
- `backend/agents/routes.py`
- `backend/agents/stream.py`
- `backend/capabilities/registry.py`
- capability domain tool modules
- canvas hydration/update routes

Look for:

- missing service slugs
- inactive agents
- capability autodiscovery failures
- missing canvas definitions
- tool payload validation errors
- permission/resource access errors
- AG-UI custom event errors

## Common Failure Modes

| Symptom | Likely cause |
| --- | --- |
| Agent missing from UI | `is_public`, `is_active`, audience/profession filtering, or sync not run. |
| Runtime says service not found | inactive/missing `AgentService` row or wrong slug. |
| Tools missing | capability not attached, autodiscovery failed, profession policy filtered the tool, or factory fallback not applicable. |
| Canvas missing | canvas not registered, sync not run, default canvas mismatch, or frontend renderer missing. |
| Form handler 404 | handler class not imported/registered or frontend sent wrong handler key. |
| User can see UI but cannot run | frontend visibility differs from runtime access or billing/demo state. |
| State changes but canvas does not update | tool did not emit refresh/update event or frontend sync hook did not receive it. |

## Production Prompt Rule

Do not add test-only instructions to production agent prompts. If testing reveals a behavior issue, fix the real tool contract, context injection, validation, policy, or prompt rule that should apply in production.

## Manual Agent QA

For an expert agent, verify:

- service discovery for the intended profession
- visitor selector behavior
- visitor/case selection
- case snapshot
- a read-only action
- a state-changing action
- canvas refresh after mutation
- denied access to a disallowed tool family

For a visitor agent, verify:

- service discovery
- own profile context
- case list and selection
- journey canvas hydration
- direct interactive test lookup
- case file read path
- canvas refresh after mutation

## Debugging Checklist

When something fails:

1. Confirm the `AgentDef` has the expected slug, audience, capabilities, and canvases.
2. Run sync.
3. Check `/api/services/` output.
4. Check prompt preview layers.
5. Check runtime logs from `create_agent_for_service()`.
6. Check capability registry registration.
7. Check profession policy filtering.
8. Check frontend canvas renderer mapping.

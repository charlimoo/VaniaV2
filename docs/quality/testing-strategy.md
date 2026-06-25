# Testing Strategy

Testing should match the risk and blast radius of the change.

## Frontend

Primary validation:

```bash
cd frontend
pnpm exec tsc --noEmit
```

Manually check affected chat, canvas, and dashboard flows when possible.

## Backend

Use targeted tests or the broader test suite depending on the change:

```bash
cd backend
venv\Scripts\activate
pytest
```

## High-Risk Areas

- Auth and role gating
- Expert profession eligibility
- Billing access
- Agent discovery
- Agent runtime streaming
- Context restoration
- Canvas hydration and updates
- Demo/preview restrictions

## What To Document Next

- Test commands by subsystem
- Required manual checks for release
- Fixture and test data conventions

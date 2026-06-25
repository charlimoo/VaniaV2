# API Validation

API documentation should be validated against route maps and build output.

## Docs Build

Run from `docs/`:

```bash
pnpm build
```

## Backend Tests

Run from `backend/`:

```bash
pytest
```

Use targeted tests when changing one API family.

## Manual Checks

Auth:

- OTP login
- password login
- profile fetch
- expert upgrade path

Services:

- service list as visitor
- service list as verified expert
- service list as wrong-profession expert
- prompt debug context
- form submit handler

Agent runtime:

- create session
- load session history
- stream one chat run
- cancel a run
- prepare and remove attachment
- public share link

Canvas:

- hydrate with visitor/patient context
- hydrate with expert/doctor/case context
- PATCH user edit
- reject read-only case edit

Billing:

- product list filtering
- purchase invoice creation
- discount application
- payment/manual payment flow

Vania:

- active visitor/expert connection
- case ownership
- read-only case sharing
- tests/files access

## Route Inventory

When route docs drift, inspect:

- `backend/core/urls.py`
- `backend/users/urls.py`
- `backend/billing/urls.py`
- `backend/services/urls.py`
- `backend/vania_core/urls.py`
- `backend/agents/routes.py`
- `backend/canvas/routes.py`

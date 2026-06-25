# API Overview

Vania exposes two backend API surfaces:

- Django/DRF APIs under `/api/*`
- FastAPI agent runtime APIs under `/agent/*`

The Next.js frontend calls both through `NEXT_PUBLIC_API_URL`, which defaults to `http://localhost:8000`.

## Root Routing

| Prefix | Framework | Purpose |
| --- | --- | --- |
| `/api/auth/` | Django/DRF | Auth, profile, wallet, expert verification |
| `/api/billing/` | Django/DRF | Billing config, products, invoices, payments, history |
| `/api/services/` | Django/DRF | Agent service discovery, prompt debug, capability form submission |
| `/api/vania/` | Django/DRF | Vania domain workflows: experts, visitors, cases, files, forms, tests |
| `/agent/` | FastAPI | AG-UI streaming, sessions, attachments, transcription, share links |
| `/agent/canvas/` | FastAPI | Canvas hydration and canvas instance updates |
| `/admin/` | Django | Django admin |

FastAPI is mounted in `backend/core/asgi.py` before Django's catch-all app.

## Authentication

Most APIs require a JWT bearer token:

```http
Authorization: Bearer <accessToken>
```

Public or semi-public endpoints include auth bootstrap endpoints, billing config/FAQ, locations, payment callbacks, and public shared chat links. Directory routes such as `/api/vania/doctors/` and `/api/vania/experts/` are named public in product terms, but the current backend requires authentication.

## Context-Aware APIs

Chat, canvas, and Vania case APIs may need selected visitor/patient, expert/doctor, and case context. Preserve both old and new aliases:

- visitor/patient
- expert/doctor
- case

See [Context Headers](/api/context-headers).

## API Design Rules

- Backend access checks are authoritative.
- Frontend hiding is presentation only.
- Role aliases must be normalized.
- Expert profession and case read-only access matter.
- Product-facing response copy may be Persian.
- Developer docs and code comments should remain English.

## Validation

Use focused checks:

```bash
cd backend
pytest
```

For docs:

```bash
cd docs
pnpm build
```

# Django App

The backend is a Django project with a mounted FastAPI agent runtime. Django owns the durable product APIs and data model; FastAPI owns live agent execution, AG-UI streaming, and runtime canvas endpoints.

## Project Entry Points

| Entry point | Purpose |
| --- | --- |
| `backend/core/settings.py` | Django settings, environment variables, database, storage, cache, Celery, JWT, CORS, AI provider environment |
| `backend/core/urls.py` | Django URL groups under `/api/...` |
| `backend/core/asgi.py` | ASGI composition: mounts FastAPI at `/agent`, then Django at `/` |
| `backend/agents/app.py` | FastAPI runtime app and canvas router mount |
| `backend/core/celery.py` | Celery app and beat schedule |

## Installed Custom Apps

| App | Responsibility |
| --- | --- |
| `users` | Custom user, phone auth, OTP, roles, expert professions, profile context |
| `billing` | Plans, products, wallet, credits, invoices, discounts, payment callbacks |
| `services` | Agent service records, service discovery, access status, RAG records, canvas models, form submission |
| `vania_core` | Domain workflows: expert/visitor connections, cases, messages, tasks, sessions, files, tests, Esanj integration |

## Django URL Groups

Mounted in `backend/core/urls.py`:

| Prefix | Django app | Notes |
| --- | --- | --- |
| `/api/auth/` | `users.urls` | Auth, profile, wallet, expert verification |
| `/api/billing/` | `billing.urls` | Storefront, invoices, payments, history, FAQ/config |
| `/api/services/` | `services.urls` | Agent service discovery, debug context, capability form submit |
| `/api/vania/` | `vania_core.urls` | Product domain workflows |

FastAPI routes are not in `core.urls.py`; they are mounted by ASGI at `/agent`.

## Core Backend Conventions

- Use Django models and services for durable product state.
- Use DRF views and serializers for normal request/response APIs.
- Use FastAPI only for agent runtime, streaming, runtime sessions, and canvas runtime endpoints.
- Keep user-facing API errors in Persian when they are shown directly in the product.
- Keep developer logs, code comments, and docs in English unless quoting existing product copy.
- Use backend access checks for role, profession, billing, and resource permissions.
- Preserve legacy aliases such as visitor/patient and expert/doctor.

## Database and Session Storage

Django database configuration is parsed from `DATABASE_URL`. The agent runtime also uses the same database through `DATABASE_CONNECTION_STRING`, which adapts the Django DB config for Agno's `SqliteDb` or `PostgresDb`.

Important files:

- `backend/core/settings.py`
- `backend/agents/storage.py`
- `backend/agents/factory.py`

## Middleware

Django middleware is configured in `backend/core/settings.py`. FastAPI runtime middleware is configured separately in `backend/agents/app.py`.

Important backend context middleware:

- `backend/agents/middleware.py`: authenticates FastAPI runtime requests and extracts scoped context headers.
- `backend/vania_core/middleware.py`: helper middleware for extracting Vania context in Django domain views. In the current settings file, Vania domain views mostly read scoped headers directly, so confirm `MIDDLEWARE` before relying on this middleware being active.

## Change Checklist

When changing backend behavior:

- Identify whether the route is Django `/api/...` or FastAPI `/agent/...`.
- Check whether the change affects roles, expert professions, billing, demo behavior, or canvas state.
- Check whether frontend service discovery depends on serializer fields.
- Run migrations if models changed.
- Run targeted tests, or `pytest` when touching shared runtime/access behavior.

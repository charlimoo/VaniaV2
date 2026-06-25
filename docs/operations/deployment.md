# Deployment

This page describes the production deployment flow for Vania.

## Deployment Shape

Production uses:

- Django + FastAPI ASGI backend served by Gunicorn/Uvicorn workers
- Next.js standalone frontend
- Celery worker
- Celery beat
- Postgres
- Redis
- MinIO or S3-compatible object storage
- Qdrant
- optional payment, SMS, Esanj, and Langfuse integrations

## Pre-Deployment Checklist

Before deploying:

- Confirm `.env` contains production values, not local examples.
- Confirm `DEBUG=False`.
- Confirm `SECRET_KEY` is stable and secret.
- Confirm `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS` contain production domains.
- Confirm `NEXT_PUBLIC_API_URL` points to the public API URL.
- Confirm database, Redis, MinIO/S3, and Qdrant are reachable from backend containers.
- Confirm AI provider credentials are present.
- Confirm payment callback domains match gateway configuration.
- Confirm `CACHE_URL` or `REDIS_URL` provides shared Redis-backed cache.

## Build Images

Build production images through Compose:

```bash
docker compose -f docker-compose.prod.yml build
```

The frontend Dockerfile receives `NEXT_PUBLIC_API_URL` as a build argument. Rebuild the frontend image when the API URL changes.

## Start or Update Services

Start production services:

```bash
docker compose -f docker-compose.prod.yml up -d
```

If using prebuilt local images:

```bash
docker compose -f docker-compose.images.yml up -d
```

`docker-compose.images.yml` uses `pull_policy: never`, so images must already exist on the host.

## Migrations and Static Files

The backend main app container runs:

```bash
python manage.py migrate --noinput
python manage.py collectstatic --noinput
```

This happens in `backend/start.sh` only for web-server commands. Worker and beat containers skip these tasks.

## Definition Sync

Run definition sync after migrations when agents, capabilities, plans, billing config, FAQs, locations, or expert professions change:

```bash
docker compose -f docker-compose.prod.yml exec app python manage.py sync
```

The sync command:

- syncs the bootstrap admin user
- syncs billing config and FAQ
- syncs agent services and suggestions
- syncs locations and expert professions
- syncs plans/products and discounts
- autodiscovers capabilities and syncs capability canvas/tool metadata

Do not rely on frontend code or database edits alone for code-defined definitions.

## Smoke Checks

After deployment:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 app
docker compose -f docker-compose.prod.yml logs --tail=100 worker
```

Then verify:

- frontend loads
- `/api/auth/profile/` returns `401` without a token
- `/api/billing/config/` returns config
- `/api/services/` works for an authenticated user
- `/agent/sessions` works for an authenticated user
- upload/media URL can be opened from the browser
- one chat run streams through `/agent/agui`
- one Celery-managed flow runs or worker logs are clean

## Rollback

Safe rollback sequence:

1. Keep database and storage volumes intact.
2. Re-deploy the previous backend and frontend images.
3. Restart `app`, `worker`, `beat`, and `frontend`.
4. Re-run smoke checks.

Database migrations may not be automatically reversible. If a migration changed schema or data incompatibly, rollback requires a tested database restore or explicit reverse migration.

## Production Differences From Local Development

| Area | Local | Production |
| --- | --- | --- |
| Backend server | Uvicorn reload | Gunicorn with Uvicorn workers |
| Frontend | `pnpm dev` | Next.js standalone server |
| Cache | May fall back during experiments | Must be shared Redis |
| Media | Local MinIO or disk | MinIO/S3 behind stable public domain |
| Static files | Local dev server or collectstatic | `collectstatic` + WhiteNoise/ASGI static route |
| Secrets | Local `.env` | Secret store or protected server `.env` |
| Celery worker | Optional for some local flows | Required for production tasks |
| Beat | Usually optional locally | Required for scheduled billing/document tasks |

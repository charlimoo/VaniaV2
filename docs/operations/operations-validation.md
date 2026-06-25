# Operations Validation

Use this checklist after changing deployment, env vars, compose files, Dockerfiles, startup scripts, storage, or background jobs.

## Docs Build

```bash
cd docs
pnpm build
```

## Local Infrastructure

```bash
docker compose -f docker-compose.local-infra.yml up -d
docker compose -f docker-compose.local-infra.yml ps
```

Verify:

- Postgres mapped to `15435`
- Redis mapped to `16379`
- MinIO mapped to `19000` and console to `19001`
- Qdrant mapped to `16333`

## Backend Checks

From `backend/`:

```bash
python manage.py migrate
python manage.py sync
pytest
```

When validating runtime manually:

```bash
uvicorn core.asgi:application --host 0.0.0.0 --port 8000 --reload
```

Verify:

- `/api/billing/config/` responds.
- `/api/auth/profile/` returns `401` without auth.
- `/agent/sessions` returns `401` without auth.
- static files are collected in container startup.

## Frontend Checks

From `frontend/`:

```bash
pnpm exec tsc --noEmit
pnpm build
```

Verify `NEXT_PUBLIC_API_URL` points to the intended backend.

## Production Compose Checks

```bash
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

Review logs:

```bash
docker compose -f docker-compose.prod.yml logs --tail=100 app
docker compose -f docker-compose.prod.yml logs --tail=100 worker
docker compose -f docker-compose.prod.yml logs --tail=100 beat
docker compose -f docker-compose.prod.yml logs --tail=100 frontend
```

## Functional Smoke Test

Minimum smoke test:

- load frontend
- sign in or verify authenticated profile request
- load service list
- create/load a chat session
- stream one agent run
- hydrate canvas for a session
- upload a small attachment or case file
- verify a media URL opens from the browser
- list billing products as visitor and expert where relevant
- check worker logs after any async action

## Rollback Readiness

Before high-risk deploys:

- confirm recent Postgres backup
- confirm media backup or bucket versioning
- record current image tags or image IDs
- confirm previous `.env` values are recoverable
- know whether the release includes irreversible migrations

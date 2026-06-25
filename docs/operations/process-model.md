# Process Model

Vania runs as a small set of cooperating processes.

## Local Development

Typical local development processes:

| Process | Command | Port |
| --- | --- | --- |
| Infrastructure | `docker compose -f docker-compose.local-infra.yml up -d` | Postgres/Redis/MinIO/Qdrant mapped to local ports. |
| Backend | `uvicorn core.asgi:application --host 0.0.0.0 --port 8000 --reload` | `8000` |
| Celery worker | `celery -A core worker -l info --pool=solo` | none |
| Frontend | `pnpm dev` from `frontend/` | usually `3000` |
| Docs | `pnpm dev` from `docs/` | `3001` |

The backend ASGI app mounts FastAPI agent routes at `/agent` before Django routes.

## Production Processes

Production Compose runs:

| Process | Command |
| --- | --- |
| `app` | `gunicorn core.asgi:application --preload --timeout 120 -w ${WEB_CONCURRENCY:-2} -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000` |
| `frontend` | Next.js standalone `node server.js` from the frontend image. |
| `worker` | `celery -A core worker -l info --concurrency=${CELERY_WORKER_CONCURRENCY:-2} --max-tasks-per-child=${CELERY_MAX_TASKS_PER_CHILD:-200}` |
| `beat` | `celery -A core beat -l info` |

## Backend Container Startup

`backend/start.sh` detects whether the container is the main web app or a worker-like process.

For the main app, it runs:

```bash
python manage.py migrate --noinput
python manage.py collectstatic --noinput
```

Workers and beat skip migrations and collectstatic, then sleep briefly before starting. This avoids multiple containers racing to run database migrations.

Definition sync is not run by `start.sh`. Run it deliberately during deployment or after definition changes:

```bash
cd backend
python manage.py sync
```

## Request Routing

ASGI routing order:

1. `/agent/*` goes to FastAPI agent runtime.
2. `/static/*` may be served by Starlette when collected static files exist.
3. `/media/*` may be served by Starlette only when local media storage is active.
4. all other routes go to Django.

When `USE_S3=True`, media URLs are absolute S3/MinIO URLs and are not served by ASGI.

## Runtime Dependencies

| Process | Hard dependencies | Optional/conditional dependencies |
| --- | --- | --- |
| `app` | Postgres, Redis/cache for production, AI provider for agent use | MinIO, Qdrant, payment/SMS/Esanj providers |
| `frontend` | Backend API URL | none |
| `worker` | Postgres, Redis | MinIO, Qdrant, AI provider depending on task |
| `beat` | Redis, Postgres | none |

## Scaling Notes

- Scale `app` horizontally only when `CACHE_URL` points to shared Redis.
- Keep `DB_CONN_MAX_AGE=0` unless a pooler such as PgBouncer is configured.
- Increase `WEB_CONCURRENCY` gradually because each worker can hold model/runtime resources.
- Increase Celery concurrency only after checking Redis, database, object storage, and AI provider rate limits.
- Run one `beat` process per environment.

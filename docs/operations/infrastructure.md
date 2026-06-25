# Infrastructure

Vania depends on Postgres, Redis, MinIO, and Qdrant for a complete local or production-like runtime.

## Compose Files

| File | Purpose |
| --- | --- |
| `docker-compose.local-infra.yml` | Local infrastructure only, with non-default host ports to avoid conflicts. |
| `docker-compose.infra.yml` | Infrastructure only, using default service ports. |
| `docker-compose.prod.yml` | Builds and runs backend, frontend, worker, beat, and infrastructure. |
| `docker-compose.images.yml` | Runs prebuilt production images with `pull_policy: never`; includes production routing details. |

## Services

| Service | Image/process | Purpose |
| --- | --- | --- |
| `db` | `postgres:15-alpine` | Django data, Agno session storage, billing, users, canvas, Vania domain data. |
| `cache` | `redis:7-alpine` | Celery broker/result backend and Django cache. |
| `minio` | MinIO | S3-compatible media storage. |
| `createbuckets` | MinIO client | Creates `vania-media` bucket and sets anonymous public access. |
| `qdrant` | `qdrant/qdrant` | Vector database for RAG and attachment knowledge. |
| `app` | Backend image | Django + FastAPI/ASGI API process. |
| `frontend` | Frontend image | Next.js standalone server. |
| `worker` | Backend image | Celery worker process. |
| `beat` | Backend image | Celery scheduler process. |

## Local Ports

`docker-compose.local-infra.yml` maps services away from common defaults:

| Service | Host port | Container port |
| --- | --- | --- |
| Postgres | `15435` | `5432` |
| Redis | `16379` | `6379` |
| MinIO API | `19000` | `9000` |
| MinIO console | `19001` | `9001` |
| Qdrant | `16333` | `6333` |

Production compose files use internal service names and expose:

- backend app: host `8001` to container `8000`
- frontend: host `3000` to container `3000`
- MinIO API/console when needed

## Volumes

| Volume | Stores |
| --- | --- |
| `postgres_data` / `local_postgres_data` | Database files. |
| `redis_data` / `local_redis_data` | Redis persistence when append-only mode is enabled. |
| `minio_data` / `local_minio_data` | Uploaded media objects. |
| `qdrant_data` / `local_qdrant_data` | Vector collections and indexes. |

Do not delete these volumes unless you intentionally want to reset persisted data.

## Startup Order

Production app startup order:

1. `db` must pass `pg_isready`.
2. `cache`, `qdrant`, and `minio` must be started.
3. `app` starts and runs backend startup tasks.
4. `frontend` starts after `app`.
5. `worker` and `beat` start after `app`, `cache`, and `db`.

`createbuckets` waits for MinIO and creates the media bucket.

## VS Code Tasks

Useful tasks in `.vscode/tasks.json`:

| Task | Purpose |
| --- | --- |
| `Start Infrastructure (Docker)` | Runs `docker compose -f docker-compose.local-infra.yml up -d`. |
| `Start Backend (Uvicorn)` | Runs ASGI backend on port `8000`. |
| `Start Celery Worker` | Runs a local Celery worker using the Windows-friendly `solo` pool. |
| `Start Frontend` | Runs Next.js dev server. |
| `Start Docs (VitePress)` | Runs docs on port `3001`. |
| `Run Full Stack App` | Starts infra, backend, worker, and frontend together. |

## Local Reset

Stop local infrastructure:

```bash
docker compose -f docker-compose.local-infra.yml down
```

Reset local infrastructure data:

```bash
docker compose -f docker-compose.local-infra.yml down -v
docker compose -f docker-compose.local-infra.yml up -d
```

Only use `-v` when losing local database, Redis, MinIO, and Qdrant data is acceptable.

## Common Failures

| Symptom | Check |
| --- | --- |
| Backend cannot connect to database | Confirm `DATABASE_URL` uses `localhost:15435` outside Compose or `db:5432` inside Compose. |
| OTP or throttling behaves inconsistently | Confirm `CACHE_URL` or `REDIS_URL` points to Redis. |
| Upload URLs work in backend but not browser | Check `AWS_S3_CUSTOM_DOMAIN`, protocol, bucket policy, and MinIO port/domain routing. |
| RAG or PDF ingestion fails | Confirm `QDRANT_URL`, Qdrant container, and AI provider credentials. |
| Frontend calls wrong backend | Rebuild or restart frontend after changing `NEXT_PUBLIC_API_URL`. |

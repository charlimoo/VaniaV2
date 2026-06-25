# Configuration

Backend configuration is centralized in `backend/core/settings.py`.

## Environment Loading

Settings load environment values from:

- `backend/.env` when running from `backend/`
- environment variables provided by the process/container

Important base values:

- `SECRET_KEY`
- `DEBUG`
- `ALLOWED_HOSTS`
- `API_DOMAIN`
- `FRONTEND_URL`
- `APP_URL`

## Database

`DATABASE_URL` configures Django's database through `dj_database_url`.

If missing, the backend falls back to SQLite at `backend/db.sqlite3`.

The agent runtime also needs an Agno-compatible connection string. `settings.py` derives `DATABASE_CONNECTION_STRING` from Django's database config:

- SQLite: `sqlite:///...`
- Postgres: `postgresql+psycopg://...`

This keeps Django models and Agno session storage pointed at the same database.

## Storage

Media storage is controlled by `USE_S3`.

When `USE_S3=False`:

- Files are stored on local disk.
- `MEDIA_URL=/media/`
- `MEDIA_ROOT=backend/media`

When `USE_S3=True`:

- `django-storages` uses S3-compatible storage.
- MinIO/S3 variables configure endpoint, bucket, credentials, public URL, region, and scheme.

Important variables:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_STORAGE_BUCKET_NAME`
- `AWS_S3_ENDPOINT_URL`
- `AWS_S3_CUSTOM_DOMAIN`
- `AWS_S3_REGION_NAME`
- `AWS_S3_URL_PROTOCOL`

## Cache, Redis, and Celery

Redis-related settings:

- `REDIS_URL`
- `CACHE_URL`
- `USE_CELERY`

If `CACHE_URL` is missing and `REDIS_URL` exists, Redis is used for Django cache. Otherwise local memory cache is used. In production, missing `CACHE_URL` is unsafe because OTP, throttling, demo usage, and access cache behavior may not work consistently across workers.

Celery uses:

- `CELERY_BROKER_URL=REDIS_URL`
- `CELERY_RESULT_BACKEND=REDIS_URL`

## JWT and DRF

Authentication uses:

- `AUTH_USER_MODEL = users.CustomUser`
- `rest_framework_simplejwt`
- `users.backends.PhoneNumberBackend`

JWT variables:

- `JWT_ACCESS_MINUTES`
- `JWT_REFRESH_DAYS`

DRF defaults:

- JWT auth.
- Authenticated permission by default.
- Django filter backend.
- Page-number pagination.
- Anonymous and user throttles.

## AI Provider

AI provider selection is handled by:

- `backend/core/ai_provider.py`

Supported providers:

- `openai`
- `gapgpt`

Important variables:

- `AI_PROVIDER`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_TIMEOUT_SECONDS`
- `GAPGPT_API_KEY`
- `GAPGPT_BASE_URL`
- `GAPGPT_TIMEOUT_SECONDS`
- `AI_TIMEOUT_SECONDS`
- `AI_TRANSCRIBE_MODEL`

`get_ai_provider_config()` is cached and validates required keys on startup.

## Vector Database

RAG uses Qdrant:

- `QDRANT_URL`
- `QDRANT_API_KEY`

Embeddings use `text-embedding-3-small` through the configured OpenAI-compatible provider.

## CORS

`CORS_ALLOWED_ORIGINS` controls browser origins.

Allowed custom headers include:

- `x-reasoning-effort`
- `x-enable-reasoning`
- `x-target-resource-id`
- `x-target-expert-id`
- `x-target-doctor-id`
- `x-target-case-id`

If adding a new frontend context or runtime header, add it to `CORS_ALLOW_HEADERS`.

## Logging

The active logging config sends logs to console. App loggers include:

- `agents`
- `capabilities`
- `services`
- `agno`
- `django`
- `uvicorn`
- `celery`

Use targeted logger names so debugging runtime, capability, and service issues stays readable.

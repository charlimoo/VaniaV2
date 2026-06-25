# Environment

Vania uses environment variables for Django, FastAPI agent runtime, Celery, object storage, vector storage, payment gateways, SMS, AI providers, and the Next.js frontend.

Reference files:

- `.env.example`
- `backend/.env`
- `frontend/.env.local`
- `prod.env`
- `backend/core/settings.py`
- `frontend/lib/api.ts`

Do not commit real production secrets. Use `.env.example` as the documented shape and keep deploy-specific values in the deployment platform secret store or server-side `.env`.

## Backend Core

| Variable | Required | Purpose |
| --- | --- | --- |
| `DEBUG` | Yes | Enables Django debug behavior. Must be `False` outside local development. |
| `SECRET_KEY` | Yes | Django signing key and JWT signing key. Rotate carefully because token/session validity depends on it. |
| `ALLOWED_HOSTS` | Yes | Comma-separated hosts accepted by Django. |
| `CORS_ALLOWED_ORIGINS` | Yes | Comma-separated frontend origins allowed to call the API. |
| `CSRF_TRUSTED_ORIGINS` | Yes | Trusted origins for Django admin and CSRF-protected flows. |
| `API_DOMAIN` | Yes | Public API base URL used in redirects and gateway callbacks. |
| `FRONTEND_URL` | Yes | Public frontend URL. |
| `APP_URL` | Yes | Canonical app URL; defaults to `FRONTEND_URL`. |

## Database

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Django and Agno session database connection. |
| `DB_CONN_MAX_AGE` | Recommended | Persistent connection lifetime. Keep `0` unless an external pooler is configured. |
| `DB_CONN_HEALTH_CHECKS` | Recommended | Enables connection health checks. |
| `POSTGRES_USER` | Compose | Database bootstrap user for Compose-managed Postgres. |
| `POSTGRES_PASSWORD` | Compose | Database bootstrap password. |
| `POSTGRES_DB` | Compose | Database bootstrap name. |

`backend/core/settings.py` derives `DATABASE_CONNECTION_STRING` from `DATABASE_URL` for the agent runtime storage adapter. Keep Django and Agno pointed at the same database.

## Cache, Redis, and Celery

| Variable | Required | Purpose |
| --- | --- | --- |
| `REDIS_URL` | Yes | Celery broker/result backend. Also used as cache fallback when `CACHE_URL` is absent. |
| `CACHE_URL` | Production | Django cache backend. Set this in production so OTP, throttling, access cache, and demo counters work across workers. |
| `USE_CELERY` | Recommended | Controls whether async delivery is used for some flows. |
| `CELERY_WORKER_CONCURRENCY` | Production | Worker process concurrency. |
| `CELERY_MAX_TASKS_PER_CHILD` | Production | Worker recycling limit. |
| `WEB_CONCURRENCY` | Production | Gunicorn web worker count. |

If `CACHE_URL` is missing and `REDIS_URL` is present, Django uses Redis as the cache. If both are missing, Django falls back to local memory cache, which is not production-safe with multiple web workers.

## Object Storage

| Variable | Required | Purpose |
| --- | --- | --- |
| `USE_S3` | Recommended | Enables S3-compatible media storage. |
| `AWS_ACCESS_KEY_ID` | If `USE_S3=True` | Storage access key. |
| `AWS_SECRET_ACCESS_KEY` | If `USE_S3=True` | Storage secret key. |
| `AWS_STORAGE_BUCKET_NAME` | If `USE_S3=True` | Media bucket name. |
| `AWS_S3_ENDPOINT_URL` | If MinIO/S3-compatible | Internal backend-to-storage endpoint. |
| `AWS_S3_CUSTOM_DOMAIN` | If public media domain exists | Browser-facing media domain. Do not include an invalid scheme for MinIO. |
| `AWS_S3_CUSTOM_MAIN_DOMAIN` | Compose/Traefik | Host used by MinIO routing labels. |
| `AWS_S3_REGION_NAME` | Recommended | Storage region, defaults to `us-east-1`. |
| `AWS_S3_URL_PROTOCOL` | Optional | Overrides public media protocol. |
| `MINIO_ROOT_USER` | Compose | MinIO bootstrap username. |
| `MINIO_ROOT_PASSWORD` | Compose | MinIO bootstrap password. |

When `USE_S3=False`, uploaded media is stored under local `MEDIA_ROOT`. When `USE_S3=True`, `django-storages` writes to MinIO/S3 and media URLs are built from the public custom domain or endpoint.

## Vector and AI Providers

| Variable | Required | Purpose |
| --- | --- | --- |
| `QDRANT_URL` | RAG/attachments | Qdrant endpoint. |
| `QDRANT_API_KEY` | Optional | Qdrant API key for managed or protected deployments. |
| `AI_PROVIDER` | Agent runtime | `openai` or `gapgpt`; defaults to `openai`. |
| `OPENAI_API_KEY` | If OpenAI provider | OpenAI API key. |
| `OPENAI_BASE_URL` | Optional | Alternate OpenAI-compatible base URL. |
| `OPENAI_TIMEOUT_SECONDS` | Optional | OpenAI timeout override. |
| `GAPGPT_API_KEY` | If GapGPT provider | GapGPT API key. |
| `GAPGPT_BASE_URL` | If GapGPT provider | GapGPT/OpenAI-compatible base URL. |
| `GAPGPT_TIMEOUT_SECONDS` | Optional | GapGPT timeout override. |
| `AI_TIMEOUT_SECONDS` | Optional | Generic AI timeout fallback. |
| `AI_TRANSCRIBE_MODEL` | Optional | Audio transcription model; defaults to `whisper-1`. |

RAG, attachment ingestion, chat generation, and transcription depend on these values.

## Auth and Throttling

| Variable | Required | Purpose |
| --- | --- | --- |
| `JWT_ACCESS_MINUTES` | Optional | Access token lifetime; defaults to `300`. |
| `JWT_REFRESH_DAYS` | Optional | Refresh token lifetime; defaults to `7`. |
| `DRF_THROTTLE_ANON` | Optional | Anonymous DRF throttle rate. |
| `DRF_THROTTLE_USER` | Optional | Authenticated DRF throttle rate. |
| `DRF_THROTTLE_REQUEST_OTP` | Optional | OTP request throttle. |
| `DRF_THROTTLE_VERIFY_OTP` | Optional | OTP verify throttle. |
| `DRF_THROTTLE_PASSWORD_LOGIN` | Optional | Password login throttle. |

## Integrations

| Variable | Required | Purpose |
| --- | --- | --- |
| `SMS_SERVICE_MODE` | Yes | `CONSOLE` for development or live provider mode when configured. |
| `SMSIR_API_KEY` | Live SMS | SMS.ir API key. |
| `SMSIR_TEMPLATE_ID` | Live SMS | OTP template ID. |
| `SMSIR_PARAMETER_NAME` | Live SMS | Template parameter name; defaults to `Code`. |
| `NAJVA_API_KEY` | Optional | Najva API key. |
| `NAJVA_SENDER_ID` | Optional | Najva sender ID. |
| `ZARINPAL_MERCHANT_ID` | Optional | ZarinPal merchant ID. |
| `ENABLE_ZARINPAL` | Optional | Enables ZarinPal payment path. |
| `ZIBAL_MERCHANT_ID` | Optional | Zibal merchant ID. In debug, the default can be sandbox-like. |
| `ESANJ_API_BASE_URL` | Esanj | Esanj API base URL. |
| `ESANJ_API_USERNAME` | Esanj | Esanj username. |
| `ESANJ_API_PASSWORD` | Esanj | Esanj password. |
| `ESANJ_API_TIMEOUT_SECONDS` | Esanj | Esanj request timeout. |

## Observability

| Variable | Required | Purpose |
| --- | --- | --- |
| `LANGFUSE_ENABLED` | Optional | Enables Langfuse/OpenTelemetry setup in ASGI startup. |
| `LANGFUSE_PUBLIC_KEY` | If enabled | Langfuse public key. |
| `LANGFUSE_SECRET_KEY` | If enabled | Langfuse secret key. |
| `LANGFUSE_HOST` | If enabled | Langfuse host, defaults to cloud host. |

## Frontend

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Yes | Browser-visible backend base URL. Used by API helpers, AG-UI runtime, and canvas sync. |
| `INTERNAL_API_URL` | Optional | Server/container-side API URL when needed. |

`NEXT_PUBLIC_API_URL` is baked into the production frontend build through `frontend/Dockerfile`, so rebuild the frontend image when this value changes.

## Local Defaults

Typical local development values:

```txt
DATABASE_URL=postgres://vania_user:vania_password@localhost:15435/vania_db
REDIS_URL=redis://localhost:16379/0
CACHE_URL=redis://localhost:16379/0
QDRANT_URL=http://localhost:16333
USE_S3=True
AWS_S3_ENDPOINT_URL=http://localhost:19000
AWS_S3_CUSTOM_DOMAIN=localhost:19000/vania-media
NEXT_PUBLIC_API_URL=http://localhost:8000
SMS_SERVICE_MODE=CONSOLE
```

Use container hostnames instead of localhost when running inside Compose:

```txt
DATABASE_URL=postgres://vania_user:vania_password@db:5432/vania_db
REDIS_URL=redis://cache:6379/0
QDRANT_URL=http://qdrant:6333
AWS_S3_ENDPOINT_URL=http://minio:9000
```

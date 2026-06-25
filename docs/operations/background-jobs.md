# Background Jobs

Vania uses Celery for asynchronous and scheduled work.

## Processes

| Process | Purpose |
| --- | --- |
| `worker` | Executes queued Celery tasks. |
| `beat` | Publishes scheduled tasks. |
| `cache`/Redis | Broker and result backend. |

Production commands:

```bash
celery -A core worker -l info --concurrency=${CELERY_WORKER_CONCURRENCY:-2} --max-tasks-per-child=${CELERY_MAX_TASKS_PER_CHILD:-200}
celery -A core beat -l info
```

Local Windows task:

```bash
celery -A core worker -l info --pool=solo
```

## Settings

| Setting | Source |
| --- | --- |
| `CELERY_BROKER_URL` | `REDIS_URL` |
| `CELERY_RESULT_BACKEND` | `REDIS_URL` |
| `CELERY_TIMEZONE` | `UTC` |
| `CELERY_TASK_SERIALIZER` | `json` |
| `CELERY_RESULT_SERIALIZER` | `json` |

## Scheduled Tasks

Configured in `backend/core/celery.py`:

| Schedule | Task | Purpose |
| --- | --- | --- |
| Daily at `00:00` UTC | `billing.tasks.reset_daily_free_credits` | Reset daily free credits. |
| Daily at `02:00` UTC | `billing.tasks.cancel_stale_invoices` | Cancel stale pending invoices. |
| Hourly at minute `30` | `services.tasks.reset_stuck_documents` | Recover stuck document ingestion states. |

`billing.tasks.clean_expired_plans` exists as a task but is not currently scheduled in beat.

## Queued Tasks

Known queued work includes:

- document ingestion through `services.tasks.ingest_document`
- billing/SMS follow-up notifications
- OTP/SMS delivery when `USE_CELERY=True`

Some flows run synchronously when Celery is disabled or unavailable.

## Operational Rules

- Run exactly one beat process per environment.
- Keep worker and app on the same code version.
- Restart workers after deploying code that changes task signatures or dependencies.
- Watch for tasks that depend on MinIO, Qdrant, AI provider credentials, or SMS/payment providers.
- Use `CELERY_MAX_TASKS_PER_CHILD` to reduce long-lived worker memory growth.

## Checks

Inspect worker logs:

```bash
docker compose -f docker-compose.prod.yml logs --tail=100 worker
```

Inspect beat logs:

```bash
docker compose -f docker-compose.prod.yml logs --tail=100 beat
```

Confirm Redis connectivity if tasks are not being consumed.

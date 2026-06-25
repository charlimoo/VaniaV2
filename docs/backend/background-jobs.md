# Background Jobs

Background jobs use Celery. The app is configured in `backend/core/celery.py`.

## Celery Setup

Important files:

- `backend/core/celery.py`
- `backend/core/__init__.py`
- `backend/core/settings.py`

Settings:

- `USE_CELERY`
- `REDIS_URL`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`
- `CELERY_TIMEZONE`

The worker command used by VS Code tasks:

```bash
venv\Scripts\activate && celery -A core worker -l info --pool=solo
```

## Beat Schedule

Configured periodic tasks:

| Schedule name | Task | Purpose |
| --- | --- | --- |
| `reset-daily-free-credits` | `billing.tasks.reset_daily_free_credits` | Reset daily free wallet usage |
| `cancel-stale-invoices` | `billing.tasks.cancel_stale_invoices` | Cancel old pending invoices |
| `reset-stuck-documents` | `services.tasks.reset_stuck_documents` | Mark stuck RAG documents as failed |

## User Tasks

`backend/users/tasks.py`:

- `users.tasks.send_sms_otp`
- `users.tasks.send_generic_sms`

Used by OTP/auth flows and billing fulfillment notifications.

## Billing Tasks

`backend/billing/tasks.py`:

- `reset_daily_free_credits`
- `clean_expired_plans` (deprecated no-op)
- `cancel_stale_invoices`

## Services Tasks

`backend/services/tasks.py`:

- `ingest_document`
- `check_expiring_plans` (deprecated no-op)
- `reset_stuck_documents`

## Development Rules

- Use `--pool=solo` on Windows local development.
- Treat Celery tasks as eventually consistent.
- Make tasks idempotent where possible.
- Do not put request-only context assumptions inside background tasks.
- Log task ids and model ids for long-running ingestion jobs.

# Runbooks

Use these short runbooks for common operational issues.

## Backend Will Not Start

Check logs:

```bash
docker compose -f docker-compose.prod.yml logs --tail=100 app
```

Then verify:

- `DATABASE_URL` host is reachable from the app container.
- Postgres healthcheck is passing.
- required env values are present.
- migrations are not failing.
- AI provider config does not fail import/startup validation.

## Frontend Calls The Wrong API

`NEXT_PUBLIC_API_URL` is browser-visible and can be baked into the frontend build.

Fix:

1. update `NEXT_PUBLIC_API_URL`
2. rebuild frontend image
3. restart frontend container
4. confirm browser network calls target the expected API domain

## Users Cannot Login Or Verify OTP

Check:

- `CACHE_URL` or `REDIS_URL`
- OTP throttle settings
- `SMS_SERVICE_MODE`
- SMS provider credentials and template ID
- worker logs if `USE_CELERY=True`

In local development, `SMS_SERVICE_MODE=CONSOLE` prints OTP delivery instead of sending real SMS.

## Agent Chat Fails

Check:

- `/api/services/` returns the selected service for the user.
- user has service access or demo access.
- `AI_PROVIDER` and provider credentials are valid.
- `QDRANT_URL` is reachable if the agent uses knowledge/RAG.
- `/agent/agui` logs for stream errors.
- `CACHE_URL` is shared if multiple app workers are running.

## Attachments Or Case Files Fail

Check:

- `USE_S3`
- `AWS_S3_ENDPOINT_URL`
- `AWS_S3_CUSTOM_DOMAIN`
- `AWS_STORAGE_BUCKET_NAME`
- MinIO `createbuckets` logs
- browser access to a known media URL

If upload returns `503`, object storage is unavailable or misconfigured.

## Canvas Does Not Hydrate

Check:

- `/agent/canvas/state/{session_id}` response
- selected `agent_id`
- context headers and query params
- visitor/patient and expert/doctor aliases
- case read-only sharing rules
- synced canvas types after `python manage.py sync`

## Billing Products Missing

Check:

- `python manage.py sync` was run after definition changes.
- product linked plans are active.
- user role/profession is eligible for the plan.
- service access cache has expired or been bumped by fulfillment.

## Payment Callback Fails

Check:

- `API_DOMAIN`
- `FRONTEND_URL`
- gateway merchant ID
- gateway callback URL registered with the payment provider
- invoice status in admin
- app logs around callback time

## Celery Tasks Not Running

Check:

```bash
docker compose -f docker-compose.prod.yml logs --tail=100 worker
docker compose -f docker-compose.prod.yml logs --tail=100 beat
docker compose -f docker-compose.prod.yml logs --tail=100 cache
```

Then verify:

- `REDIS_URL`
- worker and beat are on the current backend image
- only one beat process is running
- task dependencies such as MinIO, Qdrant, SMS, or AI provider are reachable

## Definition Drift

Symptoms:

- service exists in code but not in UI
- new canvas type does not appear
- plan/product changes are missing
- professions or FAQs are stale

Fix:

```bash
docker compose -f docker-compose.prod.yml exec app python manage.py sync
```

Then reload the affected frontend flow.

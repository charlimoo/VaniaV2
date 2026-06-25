# Observability

Vania currently relies on console logging plus optional Langfuse/OpenTelemetry tracing for agent activity.

## Logging

Logs go to stdout/stderr and are collected by the process manager or container platform.

Configured loggers in `backend/core/settings.py` include:

- root logger
- `agents`
- `capabilities`
- `services`
- `agno`
- `django`
- `uvicorn`
- `celery`

Application log format includes level, timestamp, logger name, and message.

## Useful Log Commands

Production Compose:

```bash
docker compose -f docker-compose.prod.yml logs --tail=100 app
docker compose -f docker-compose.prod.yml logs --tail=100 worker
docker compose -f docker-compose.prod.yml logs --tail=100 beat
docker compose -f docker-compose.prod.yml logs --tail=100 frontend
```

Follow logs:

```bash
docker compose -f docker-compose.prod.yml logs -f app
```

## Langfuse and OpenTelemetry

ASGI startup calls `init_observability()` from `backend/agents/ops.py`.

Required settings:

- `LANGFUSE_ENABLED=True`
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_HOST`

When enabled, the backend:

1. builds a Langfuse OTLP endpoint at `${LANGFUSE_HOST}/api/public/otel`
2. sets `OTEL_EXPORTER_OTLP_ENDPOINT`
3. sets `OTEL_EXPORTER_OTLP_HEADERS`
4. registers an OpenTelemetry tracer provider
5. instruments Agno

If keys are missing, observability is skipped and a warning is logged.

## What To Watch

| Area | Signals |
| --- | --- |
| API health | 5xx logs, repeated 401/403 spikes, payment callback errors. |
| Agent runtime | `/agent/agui` run errors, model provider timeouts, tool failures. |
| Canvas | hydration errors, read-only edit rejections, stale state warnings. |
| Billing | invoice cancellation, gateway callback failures, fulfillment errors. |
| Storage | upload/download `503`, missing files, MinIO connectivity errors. |
| Background jobs | worker task exceptions, beat not scheduling, stuck document resets. |

## Gaps

There is no dedicated `/health` endpoint documented in the current backend. Operational checks should use container health, logs, and lightweight API probes until a formal health endpoint is added.

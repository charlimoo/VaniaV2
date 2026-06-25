# Backup and Recovery

Vania recovery depends on four persistent stores:

- Postgres
- MinIO/S3 media bucket
- Qdrant
- Redis, when persistence matters for queued work

## Backup Priority

| Store | Priority | Why |
| --- | --- | --- |
| Postgres | Critical | Source of truth for users, billing, sessions, services, canvas, and Vania domain data. |
| MinIO/S3 | Critical | Uploaded files, voice notes, case files, test attachments, media. |
| Qdrant | High | Vector indexes for RAG and attachment knowledge. Can sometimes be rebuilt, but not instantly. |
| Redis | Medium | Queues/cache. Persistent Redis helps avoid losing queued tasks during maintenance. |

## Postgres Backup

Example logical backup:

```bash
docker compose -f docker-compose.prod.yml exec db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > vania-db.sql
```

For large production databases, prefer platform-native backups or compressed custom-format dumps.

## Postgres Restore

Restore only into a prepared target environment:

```bash
docker compose -f docker-compose.prod.yml exec -T db psql -U "$POSTGRES_USER" "$POSTGRES_DB" < vania-db.sql
```

After restore:

```bash
docker compose -f docker-compose.prod.yml exec app python manage.py migrate --noinput
docker compose -f docker-compose.prod.yml exec app python manage.py sync
```

## Media Backup

For MinIO, back up the `minio_data` volume or mirror the bucket with MinIO client:

```bash
mc mirror myminio/vania-media ./backup/vania-media
```

For managed S3, use provider lifecycle, versioning, replication, or scheduled bucket sync.

## Qdrant Backup

Back up the `qdrant_data` volume or use Qdrant snapshot support if enabled in the deployment. Keep Qdrant backups near the matching Postgres/media backup time because vector records reference uploaded content and knowledge documents.

## Redis Backup

Redis is used for cache and Celery. Losing Redis usually loses transient cache and queued work, not canonical app data. In production, append-only persistence is enabled in compose with:

```text
redis-server --appendonly yes
```

## Recovery Checks

After restore:

- Log in as a known user.
- Load `/api/services/`.
- Open an existing chat session.
- Hydrate canvas state for an existing thread.
- Open a known uploaded file.
- Run one agent message that uses Qdrant-backed knowledge.
- Confirm billing config and products are present.
- Confirm Celery worker and beat logs are clean.

## Disaster Recovery Notes

- Keep `.env` and secrets backed up separately from code.
- Keep `SECRET_KEY` stable across restore unless intentionally invalidating tokens.
- Restore database and media together whenever possible.
- Run definition sync after restore to repair code-defined services, plans, professions, FAQs, and capability metadata.

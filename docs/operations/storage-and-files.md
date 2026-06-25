# Storage and Files

Vania stores structured data in Postgres, transient/shared state in Redis, media in local disk or S3-compatible storage, and vector knowledge in Qdrant.

## Postgres

Postgres stores:

- users, roles, expert professions
- billing plans, products, invoices, wallets, transactions
- service and canvas metadata
- Vania case/profile/test/file/task/session data
- Agno chat/session storage
- public share metadata

`DATABASE_URL` is the source of truth for Django. `DATABASE_CONNECTION_STRING` is derived from it for the agent runtime.

## Redis

Redis is used for:

- Celery broker
- Celery result backend
- Django cache when `CACHE_URL` or `REDIS_URL` is configured
- OTP/throttling/cache-backed access behavior

Production must use shared Redis-backed cache. Local memory cache is acceptable only for single-process development.

## Media Storage

Media includes:

- chat attachments
- case files
- clinical test files
- voice notes
- generated/downloadable files where supported

When `USE_S3=False`:

- Django uses local filesystem storage.
- ASGI can serve `/media/*` during local development.

When `USE_S3=True`:

- Django uses `storages.backends.s3.S3Storage`.
- MinIO/S3 stores files in `AWS_STORAGE_BUCKET_NAME`.
- `AWS_S3_ENDPOINT_URL` is the internal backend endpoint.
- `AWS_S3_CUSTOM_DOMAIN` is the browser-facing public media host/path.
- ASGI does not serve media files directly.

## MinIO Bucket

Compose starts a `createbuckets` helper that creates:

```text
vania-media
```

It also sets anonymous public access for the bucket. If files upload but browser downloads fail, check this helper, the bucket policy, and the public domain routing.

## Public Media URL Rules

`backend/core/settings.py` normalizes `AWS_S3_CUSTOM_DOMAIN`:

- It can include a host and optional path, such as `files.example.com/vania-media`.
- It should not include an invalid scheme.
- `AWS_S3_URL_PROTOCOL` can force `http:` or `https:`.
- Local public domains such as `localhost` can use `http:` in debug/local mode.

For production, use a stable HTTPS domain.

## Qdrant

Qdrant stores vector collections for:

- RAG knowledge documents
- attachment/session knowledge
- agent memory/search flows where configured

Settings:

- `QDRANT_URL`
- `QDRANT_API_KEY`

The local infrastructure maps Qdrant to `http://localhost:16333`. Inside Compose, use `http://qdrant:6333`.

## Storage Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Upload returns `503` | Object storage unavailable or credentials/bucket invalid. |
| File exists but browser cannot open it | Public domain, bucket policy, protocol, or Traefik/MinIO routing issue. |
| Backend cannot open uploaded file | Wrong internal `AWS_S3_ENDPOINT_URL` or missing object in bucket. |
| RAG search returns nothing after upload | Qdrant unavailable, ingestion failed, or AI embedding provider failed. |
| Local upload URL points to production domain | Local `.env` has production `AWS_S3_CUSTOM_DOMAIN`. |

## Data Safety

Back up Postgres and MinIO together for a consistent recovery point. Qdrant can often be rebuilt from source documents, but backing it up reduces recovery time.

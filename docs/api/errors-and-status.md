# Errors and Status

Vania APIs use both DRF and FastAPI error responses. Frontend code should handle status codes rather than depending only on message text.

## Common Status Codes

| Status | Meaning |
| --- | --- |
| `200` | Successful read/update or accepted runtime operation. |
| `201` | Created resource, such as invoice/session. |
| `400` | Validation error or malformed request. |
| `401` | Missing or invalid authentication. |
| `402` | Insufficient credits/payment required for chargeable runtime/service operation. |
| `403` | Authenticated but not allowed. |
| `404` | Resource not found or not visible to this user. |
| `429` | Throttled auth flow. |
| `500` | Unexpected server/runtime failure. |

## DRF Errors

DRF endpoints commonly return:

```json
{
  "detail": "..."
}
```

or field errors:

```json
{
  "field_name": ["..."]
}
```

Some legacy endpoints return:

```json
{
  "error": "..."
}
```

## FastAPI Errors

FastAPI endpoints commonly return:

```json
{
  "detail": "..."
}
```

Streaming `/agent/agui` can also emit AG-UI `RUN_ERROR` events after a stream has started.

## Access Error Rules

- Use `401` for unauthenticated requests.
- Use `403` for authenticated users who are not eligible or cannot mutate read-only resources.
- Use `404` when revealing resource existence would be unsafe or when resource is genuinely missing.
- Use `402` for credit/payment shortfalls.

## Frontend Handling

`frontend/lib/api.ts` wraps failed fetches in `ApiError`.

Chat/runtime code should preserve loaded state where possible and surface retryable failures clearly.

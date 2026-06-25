# API Client

Frontend API calls should go through shared helpers where possible so base URLs, auth headers, and errors behave consistently.

## Base URL

Key file:

- `frontend/lib/api.ts`

`API_BASE_URL` is resolved from:

```text
NEXT_PUBLIC_API_URL || http://localhost:8000
```

Use this constant for Django and FastAPI runtime calls unless a library requires its own URL configuration.

## Auth Headers

`getAuthHeaders()` reads `accessToken` from `localStorage` and returns a bearer token header when available.

Do not duplicate token lookup code in page components. If a feature needs auth headers, prefer the shared helper or a small wrapper around it.

## Fetch Wrapper

`fetcher` wraps API calls with:

- API base URL handling
- JSON content type
- auth headers
- response parsing
- `ApiError` on failed responses

Use `ApiError` when UI needs to branch on backend status codes or structured error payloads.

## Backend API Families

The frontend primarily talks to:

| Backend path | Purpose |
| --- | --- |
| `/api/auth/` | login, registration, profile, auth state |
| `/api/services/` | service discovery, forms, access metadata |
| `/api/billing/` | plans, payments, credits, invoices |
| `/api/vania/` | Vania domain resources |
| `/agent/sessions` | chat session list, create, rename, delete, hydrate |
| `/agent/agui` | AG-UI streaming run endpoint |
| `/agent/canvas/*` | canvas hydration and persistence |
| `/agent/attachments/*` | attachment preparation and removal |

## Error Handling

Prefer feature-level error states over silent failures. For chat/runtime operations, preserve already-loaded data where possible and let the user retry the failed operation.

For access errors, keep frontend messaging aligned with backend access state and billing/demo metadata.

## API Change Checklist

When adding or changing frontend API calls:

- use `API_BASE_URL`
- include auth headers where required
- preserve visitor/patient and expert/doctor aliases in chat context
- handle `401` and `403` separately when the UX differs
- avoid hardcoding backend hostnames in components
- check whether the call belongs in a shared adapter instead of a page

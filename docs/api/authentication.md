# Authentication

Vania uses JWT bearer tokens for authenticated API access.

## Token Header

Use:

```http
Authorization: Bearer <accessToken>
```

The frontend stores tokens in `localStorage`:

- `accessToken`
- `refreshToken`

## Frontend Helpers

Key file:

- `frontend/lib/api.ts`

Important exports:

- `API_BASE_URL`
- `getAuthHeaders`
- `fetcher`
- `ApiError`

Use shared helpers instead of hand-building auth headers in components.

## Runtime Auth

Django/DRF endpoints use DRF auth/permissions. FastAPI runtime endpoints use `django_auth_middleware` and `get_current_user`.

Public shared chat routes are intentionally unauthenticated.

## Auth Boundary

Authentication answers "who is this user?" Access checks still happen separately for:

- role
- expert verification
- profession
- active plan
- service eligibility
- resource ownership/sharing
- case read-only mode

## Public Endpoints

Public or allow-any endpoints include:

- `/api/auth/check-exists/`
- `/api/auth/request-otp/`
- `/api/auth/verify-otp/`
- `/api/auth/complete-signup/`
- `/api/auth/login/`
- `/api/auth/verify-doctor/`
- `/api/auth/verify-expert/`
- `/api/auth/expert-professions/`
- `/api/billing/config/`
- `/api/billing/faqs/`
- `/api/billing/callback/`
- `/api/billing/zibal/callback/`
- `/api/vania/locations/`
- `/agent/share/{token}`

Always check the view permission class before treating an endpoint as public.

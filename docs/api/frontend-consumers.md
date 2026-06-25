# Frontend Consumers

This page maps the main frontend code paths to backend APIs.

## Shared API Client

Key file:

- `frontend/lib/api.ts`

Uses:

- `NEXT_PUBLIC_API_URL`
- `getAuthHeaders`
- `fetcher`
- `ApiError`

## Auth

Consumers:

- `frontend/components/providers/user-provider.tsx`
- auth/root page components
- dashboard settings/profile flows

Important endpoints:

- `/api/auth/profile/`
- `/api/auth/login/`
- `/api/auth/request-otp/`
- `/api/auth/verify-otp/`
- `/api/auth/complete-signup/`
- `/api/auth/change-password/`
- `/api/auth/expert-professions/`
- `/api/auth/upgrade-expert/`

## Services and Chat

Consumers:

- chat page
- dashboard service cards
- `frontend/lib/SimpleThreadAdapters.ts`
- `frontend/lib/ag-ui`

Important endpoints:

- `/api/services/`
- `/agent/sessions`
- `/agent/agui`
- `/agent/attachments/prepare`
- `/agent/transcribe`
- `/agent/share/{session_id}`

## Canvas

Consumers:

- `frontend/lib/canvas/useCanvasSync.ts`
- `frontend/lib/canvas/store.ts`
- `frontend/components/canvas`

Important endpoints:

- `/agent/canvas/state/{threadId}`
- `/agent/canvas/instance/{id}`

## Dashboard and Vania

Consumers:

- dashboard visitors/patients pages
- journey page
- messages page
- settings/profile pages
- billing pages
- canvas renderers

Important endpoints:

- `/api/vania/my-visitors/`
- `/api/vania/my-patients/`
- `/api/vania/my-base-profile/`
- `/api/vania/cases/*`
- `/api/vania/roadmap/`
- `/api/vania/appendix/`
- `/api/vania/tests/`
- `/api/vania/case-files/`
- `/api/billing/*`

## Public Pages

Consumers:

- public share page
- support/terms pages
- payment callback route

Important endpoints:

- `/agent/share/{token}`
- `/api/billing/config/`
- `/api/billing/zibal/callback/`

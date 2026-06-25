# Public Pages

Public pages live under `frontend/app/(public)` plus the root app entry. They should load without authenticated profile state unless the page intentionally offers an optional signed-in experience.

## Public Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing/auth entry |
| `/support` | Public support page |
| `/terms` | Public terms page |
| `/share/[token]` | Public read-only shared chat |

## Root Entry

`frontend/app/page.tsx` is the root entry. It renders the public/auth experience and should stay independent from dashboard-only assumptions.

## Shared Chat Pages

`/share/[token]` renders public shared chat content fetched from the backend share endpoint. It should be treated as read-only:

- no message sending
- no session mutation
- no canvas mutation
- no attachment deletion
- no authenticated-only controls

If shared content includes rich assistant/tool output, keep the renderer safe for unauthenticated visitors.

## Support and Terms

Support and terms pages are public product pages. Product-facing copy should remain Persian unless the product intentionally changes language.

## Billing Callback Route

`frontend/app/api/billing/zibal/callback/route.ts` is a Next route handler for billing callback behavior.

Treat app route handlers as server-side code in the frontend package. Validate them with `pnpm build` after changes.

## Public Page Checklist

When changing public pages, verify:

- pages load without tokens
- `UserProvider` does not redirect them away
- shared chat is read-only
- product copy and layout remain RTL/Persian
- route handler changes pass a Next build

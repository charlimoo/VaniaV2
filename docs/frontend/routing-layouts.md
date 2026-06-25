# Routing and Layouts

The frontend uses the Next.js App Router under `frontend/app`. Route groups separate public pages, authenticated dashboard flows, and the chat workspace while sharing the same root providers.

## Root Layout

`frontend/app/layout.tsx` defines the global document shell:

- `lang="fa"` and `dir="rtl"` for the Persian product UI.
- Local IRANSans font.
- Theme, config, user, onboarding, and toaster providers.
- Global widget/script initialization.

Because this layout wraps all pages, treat changes here as app-wide changes.

## Route Groups

| Path | Group | Purpose |
| --- | --- | --- |
| `/` | root | Public landing/auth entry |
| `/chat/[agentId]/[threadId]` | `(chat)` | Authenticated agent workspace |
| `/dashboard/*` | `(dashboard)` | Authenticated product workflows |
| `/share/[token]` | `(public)` | Public read-only shared chat |
| `/support` | `(public)` | Public support page |
| `/terms` | `(public)` | Public terms page |
| `/api/billing/zibal/callback` | `app/api` | Browser-facing billing callback handler |

## Chat Layout

`frontend/app/(chat)/chat/layout.tsx` creates a nested shell with:

- dashboard rail on the right
- chat sidebar beside it
- chat layout context
- authenticated access behavior

This layout is specialized for long-lived chat sessions and should not be reused for normal dashboard pages.

## Dashboard Layout

`frontend/app/(dashboard)/dashboard/layout.tsx` creates the authenticated dashboard shell with:

- main dashboard sidebar
- global header
- constrained content area
- dashboard-specific spacing

Dashboard pages should use this layout for authenticated product workflows outside the chat runtime.

## Public Layouts

Public routes live in `frontend/app/(public)`. They should avoid requiring authenticated state unless the specific page intentionally has an optional signed-in experience.

Public shared chat pages are read-only product surfaces. Keep them isolated from authenticated runtime actions such as sending messages, updating canvas state, or deleting attachments.

## Route Change Checklist

Before adding or moving a route:

- Confirm whether it is public, dashboard, or chat.
- Check whether it needs `UserProvider` profile state.
- Decide whether role guards are presentation only or whether the backend also needs an access rule.
- Preserve existing Persian/RTL behavior for product UI.
- Run TypeScript validation and a Next build for route-level changes.

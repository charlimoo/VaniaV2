# Next App

The frontend is a Next.js App Router application in `frontend/`. It owns the product shell, authenticated dashboard, chat workspace, canvas rendering, public pages, browser state, and API adapters.

The app is Persian-first for product UI and RTL at runtime, while this documentation and contributor-facing content stay in English.

## Runtime Stack

| Area | Implementation |
| --- | --- |
| Framework | Next.js 16 App Router |
| UI runtime | React 19 |
| Package manager | `pnpm` |
| Styling | Tailwind CSS 4, CSS variables, local IRANSans font |
| UI primitives | Radix UI, local component wrappers, `lucide-react` icons |
| Chat runtime | `@ag-ui/client`, `@assistant-ui/react`, custom adapters |
| State | React context and Zustand stores |
| Forms | `react-hook-form`, `zod` where needed |
| Charts and visuals | Recharts, D3, Three.js where used by specific UI surfaces |

## Important Files

| File | Purpose |
| --- | --- |
| `frontend/package.json` | Scripts and frontend dependencies |
| `frontend/next.config.ts` | Next output mode and image policy |
| `frontend/tsconfig.json` | Strict TypeScript settings and `@/*` path alias |
| `frontend/app/layout.tsx` | Global HTML direction, providers, font, toaster, widget scripts |
| `frontend/app/page.tsx` | Public landing/auth entry |
| `frontend/app/globals.css` | Global styles, Tailwind import, design tokens |
| `frontend/lib/api.ts` | Base API URL, auth headers, fetch wrapper |

## Route Groups

| Group | Purpose |
| --- | --- |
| `frontend/app/(chat)` | Authenticated chat workspace and canvas collaboration shell |
| `frontend/app/(dashboard)` | Authenticated product workflows outside chat |
| `frontend/app/(public)` | Public support, terms, and shared chat pages |
| `frontend/app/api` | Next route handlers for browser-facing callbacks |

## Global Providers

The root layout wires app-wide concerns:

- `ThemeProvider`: theme handling, defaulting to dark mode in the current configuration.
- `ConfigProvider`: shared runtime configuration context.
- `UserProvider`: authentication/profile loading and redirect behavior.
- `GlobalOnboardingPrompts`: product onboarding prompts.
- `Toaster`: global toast surface with RTL direction.

Because these providers wrap all route groups, changes here affect public, dashboard, and chat surfaces.

## Build Configuration

`frontend/next.config.ts` uses standalone output for deployment packaging and a permissive image policy that supports remote images, SVG handling with CSP, and local MinIO media URLs for development.

Keep image policy changes deliberate. The chat and dashboard may render user or backend-provided media, so restrictions can break attachments, profile images, invoices, or share previews.

## TypeScript Configuration

`frontend/tsconfig.json` enables strict mode, `noEmit`, bundler module resolution, and the `@/*` alias pointing at the frontend root.

Prefer importing shared code through `@/lib`, `@/components`, and `@/hooks` instead of long relative paths when crossing feature folders.

## Validation

Use TypeScript validation as the primary frontend check:

```bash
cd frontend
pnpm exec tsc --noEmit
```

Do not rely on `pnpm lint` until the Next lint setup is updated.

Use `pnpm build` when changing routing, layouts, Next config, dynamic imports, or server route handlers.

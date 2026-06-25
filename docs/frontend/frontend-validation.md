# Frontend Validation

Use focused validation for the frontend. The primary automated check is TypeScript.

## Primary Check

Run from `frontend/`:

```bash
pnpm exec tsc --noEmit
```

Use this for most frontend changes.

## Build Check

Run a Next build when changing:

- route files
- layouts
- `next.config.ts`
- dynamic imports
- app route handlers
- metadata or manifest behavior
- code that only fails during production compilation

```bash
pnpm build
```

## Lint Note

Do not rely on `pnpm lint` as the main validation command until the Next lint setup is updated for this project.

## Manual Checks

For chat changes, verify:

- loading an existing thread
- creating a new draft thread
- sending and cancelling a message
- attachment preparation and removal
- canvas hydration and update events
- billing/demo locked states
- mobile chat/canvas switching

For dashboard changes, verify:

- unauthenticated redirect
- visitor role behavior
- expert role behavior
- staff/admin behavior when relevant
- mobile sidebar behavior
- billing/access state display

For public pages, verify:

- no-token access
- shared chat read-only behavior
- Persian copy and RTL layout

## Documentation Checks

When changing this docs app, run from `docs/`:

```bash
pnpm build
```

This catches broken VitePress config, invalid links that VitePress can detect, and markdown build issues.

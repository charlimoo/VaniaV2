# Styling and Localization

The product frontend is Persian-first and RTL. Developer documentation stays English and LTR.

## Direction

`frontend/app/layout.tsx` sets:

```tsx
<html lang="fa" dir="rtl">
```

Assume product UI is RTL unless a specific embedded surface requires LTR content, such as code, URLs, logs, or developer-facing snippets.

## Fonts

The root layout loads the local IRANSans font from:

```text
frontend/app/fonts/IRANSansXV.ttf
```

Use the existing font setup for product pages. Avoid adding page-local font systems unless the product design intentionally requires it.

## Global Styles

Important files:

- `frontend/app/globals.css`
- `frontend/app/layout.tsx`
- component-level Tailwind classes

Global styles should define broad tokens and resets. Feature-specific layout should remain near the component or page that owns it.

## Theme

The current root provider configuration defaults to dark mode. Components should use existing theme tokens and variants instead of hardcoding one-off colors.

When changing colors, check dashboard, chat, canvas, modals, and public pages because shared components can appear in several route groups.

## Localization Rules

- Product UI copy: Persian.
- Developer docs: English.
- Code comments: English unless preserving existing product text.
- API field names: preserve backend contracts.
- Role aliases: preserve both visitor/patient and expert/doctor naming where still used.

## LTR Islands

Use explicit LTR styling for:

- code blocks
- URLs
- IDs
- JSON
- logs
- technical labels that become unreadable in RTL

Keep these local. Do not flip a whole product page to LTR unless the feature is genuinely developer-facing.

## Styling Checklist

When changing styles:

- test narrow mobile and desktop widths
- verify Persian text alignment and wrapping
- check modal and drawer direction
- confirm icons still imply the correct direction in RTL
- avoid hardcoded colors when tokens exist
- keep shared component changes compatible across route groups

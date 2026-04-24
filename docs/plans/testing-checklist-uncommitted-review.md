# Uncommitted Changes Review And Testing Checklist

## Review Findings

1. High: online payment cannot redirect to Zibal in the current UI flow.
   Backend now returns `action_url`, but the invoice page still only handles `redirect_url`.
   Relevant files:
   - [backend/billing/views.py](/d:/Projects/VaniaV2/backend/billing/views.py:266)
   - [frontend/app/(dashboard)/dashboard/invoices/[id]/page.tsx](/d:/Projects/VaniaV2/frontend/app/(dashboard)/dashboard/invoices/[id]/page.tsx:115)

2. High: several required files are still untracked, so the changeset is incomplete unless they are added.
   Untracked files:
   - [backend/billing/gateways/zibal.py](/d:/Projects/VaniaV2/backend/billing/gateways/zibal.py:1)
   - [backend/billing/migrations/0009_invoice_card_number.py](/d:/Projects/VaniaV2/backend/billing/migrations/0009_invoice_card_number.py:1)
   - [backend/definitions/cities.json](/d:/Projects/VaniaV2/backend/definitions/cities.json:1)
   - [backend/users/throttles.py](/d:/Projects/VaniaV2/backend/users/throttles.py:1)
   - [frontend/app/api/billing/zibal/callback/route.ts](/d:/Projects/VaniaV2/frontend/app/api/billing/zibal/callback/route.ts:1)
   - [frontend/lib/location-utils.ts](/d:/Projects/VaniaV2/frontend/lib/location-utils.ts:1)

3. Medium: the OTP screen always shows the password-login path, even for users who may not have a password.
   Relevant file:
   - [frontend/components/auth/auth-container.tsx](/d:/Projects/VaniaV2/frontend/components/auth/auth-container.tsx:279)

## Validation Notes

- Frontend typecheck passed with `pnpm exec tsc --noEmit`.
- Backend pytest could not run in this environment because `corsheaders` is missing.

## Minimal Testing Checklist

### Auth

- [ ] Existing user with password: enter phone number and confirm the flow goes to password login.
- [ ] New user signup: enter a fresh phone number, receive OTP, verify it, complete signup, and land in dashboard.
- [ ] OTP resend: request OTP, try immediate resend, then retry after cooldown.

### Chat

- [ ] Multi-voice draft: record multiple clips in chat, transcribe each one, edit the combined text, and send it.
- [ ] PDF preview: attach a PDF in chat composer and confirm it shows a PDF tile and opens preview.
- [ ] PDF processing error: try a problematic PDF and confirm the app shows a readable failure message.
- [ ] Credit exhaustion: hit a `402` path if possible and confirm the modal/toast sends the user to billing.

### Billing

- [ ] Invoice page renders online payment option and gateway messaging correctly.
- [ ] Manual payment / invoice details still render correctly after the invoice field changes.
- [ ] Do not rely on Zibal online payment as passed yet; current redirect handling looks broken.

### Locations And Profile

- [ ] Doctor search: location picker loads full province/city options and search works.
- [ ] Doctor search results: searching by doctor name, specialty, profession, and location works.
- [ ] Doctor profile modal: location picker works correctly and saves the selected province/city.
- [ ] Visible label check: `روانشناس` appears as `روانشناس و مشاور`.

### Mobile / Canvas

- [ ] Patient journey tabs are usable on mobile via horizontal scrolling.
- [ ] Case files tab remains readable on mobile and action buttons stay accessible.
- [ ] Forms/test picker popovers still behave correctly on small screens.

## Known Blockers

- Online payment flow needs verification after fixing `action_url` vs `redirect_url`.
- Any environment or deployment test must include the currently untracked files above.

# Billing Gap Report

Date: 2026-04-11

## Scope

This report compares the intended billing model in [docs/billing.md](/d:/Projects/VaniaV2/docs/billing.md) with the current implementation across:

- `backend/definitions/billing.py`
- `backend/definitions/sync.py`
- `backend/billing/*`
- `backend/services/access_service.py`
- `backend/services/serializers.py`
- `backend/agents/service_agent.py`
- `frontend/app/(dashboard)/dashboard/billing/page.tsx`
- `frontend/components/billing/*`
- `frontend/lib/types.ts`

## Executive Summary

The current system is not a thin implementation gap from `docs/billing.md`; it is a different billing architecture.

The document describes a policy-driven subscription model:

- fixed public and professional price books
- a free tier limited to `روان‌یار`
- empathy credit for non-subscribers
- gifting and social allocation
- conversation capital as a non-spendable social metric
- international linear pricing
- separate test add-ons

The codebase currently implements a wallet-and-credit economy:

- subscription plans grant expiring credit quotas and agent bundles
- top-up credits are a second spendable balance
- free users consume a daily free credit allowance
- access is controlled by agent inclusion inside plans
- demo/preview behavior is mixed into access control

In practice, the current implementation is only partially aligned with the target in a few areas:

- prices are stored in toman
- there is a plan/invoice/payment flow
- there is a daily free allowance
- there is a manual renewal flow

Across 14 major policy areas, the comparison is:

- `1` aligned
- `3` partially aligned
- `10` materially different or missing

## Important Note About `docs/billing.md`

`docs/billing.md` itself is not fully canonical yet. The three sections conflict on some important decisions:

1. General subscriptions:
   - documents 1 and 2 describe monthly plus annual discount
   - document 3 adds `3 ماهه` and `6 ماهه` plans
2. Professional pricing:
   - documents 1 and 2 define bronze/silver/gold prices
   - document 3 also says `۲,۰۰۰,۰۰۰ تومان` is the same base price for all specialists, then reintroduces bronze/silver/gold multipliers
3. Product shape:
   - documents 1 and 2 describe “full access” subscription logic
   - current code is quota-based

Before implementation work starts, the team should publish one canonical billing policy and retire the other variants.

## Current Billing Architecture

### What exists today

- `SubscriptionPlan` stores `price`, `duration_days`, `included_credits`, `audience`, and profession eligibility.
- `BillingProduct` can either:
  - activate a linked plan, or
  - add top-up credits
- `UserWallet` has:
  - `active_plan`
  - `plan_expires_at`
  - `balance_plan`
  - `balance_paid`
  - `daily_free_used`
- usage billing deducts by token volume via `tokens_per_credit`
- access is plan-bundle based:
  - free agents are always accessible
  - paid agents require the active plan to include that agent
- plan renewal stacks `included_credits` on same-plan renewals
- expired plans are cleaned up daily and their `balance_plan` is zeroed

### What this means functionally

- subscriptions are not “unlimited access”; they are quota carriers
- spendable credits are central to the design
- “conversation capital” is currently the spendable currency label, not a social metric
- top-up balance is treated as overage for subscribers, not as standalone empathy credit for free users

## Gap Matrix

| Area | Target in `billing.md` | Current implementation | Status | Notes |
|---|---|---|---|---|
| Base currency | Toman is the source of truth | prices are stored in toman | Aligned | This is the only clearly aligned part |
| International pricing | global linear pricing: `IRT / 1000` into target currency and crypto | no country-aware pricing, no currency resolver, no crypto support | Missing | all invoices/products are toman-only |
| General subscription pricing | `690,000` monthly, `20%` annual discount, possibly 3/6/12 variants depending on section | visitor plans are `490,000`, `1,290,000`, `4,590,000` with credits | Different | current pricing and packaging do not match the document |
| General subscription behavior | full access, effectively unlimited conversation usage | plans grant expiring credit quotas and bundled agents | Different | this is the biggest structural mismatch |
| Free tier | only `روان‌یار`, max `2` questions/day | free users get `5` daily credits and currently have multiple free agents | Different | current free catalog is much broader |
| Empathy credit | only for users without active subscription and usable as a free-tier overflow | top-ups can be bought by everyone, but free users cannot spend them without an active plan | Different | this directly conflicts with the policy |
| Gifted conversation | annual discount can be donated | no gifting model or allocation flow | Missing | no data model, API, or UI |
| Empathy gift | free-form donation converted into empathy credit | no donation/gift model | Missing | no invoice/product type for this |
| Conversation capital | non-spendable social participation metric | “conversation capital” is currently the spendable credit name | Different | semantic collision in product language and domain model |
| Professional subscriptions | bronze/silver/gold plus supercharge | profession-specific 30/90/365 plans with different prices and agent bundles | Different | current pricing is profession-based, not tier-based |
| International parity | same access logic across currencies/countries | no regional billing logic exists | Missing | cannot enforce the document’s parity rules yet |
| Tests and assessments | separate add-on products with `20%` IA analysis fee | no billing primitives for test add-ons | Missing | no test product catalog or fee computation path |
| VAT / tax | applied at checkout by gateway | no tax modeling or invoice tax line items | Missing | invoice total is product price minus discount only |
| Renewal / cancellation / consent | monthly/yearly subscriptions, auto-renew only with consent, no carryover refund | manual renewals exist, no recurring consent model, no cancellation state machine | Partial | some expiry behavior exists, policy behavior does not |

## Detailed Findings

### 1. Current pricing and plan catalog do not match the target model

The current synced price book is defined in `backend/definitions/billing.py`.

Current public plans:

- `visitor-30d`: `490,000`
- `visitor-90d`: `1,290,000`
- `visitor-365d`: `4,590,000`

Current expert plans are profession-specific and not tier-based:

- lawyers: `790,000` / `2,090,000` / `7,590,000`
- psychiatrists: `890,000` / `2,390,000` / `8,690,000`
- psychologists: `990,000` / `2,690,000` / `9,990,000`
- general doctors: `790,000` / `2,090,000` / `7,590,000`

This is fundamentally different from the document’s simple public plan plus bronze/silver/gold expert tiers.

### 2. The runtime is credit-metered, not subscription-unlimited

The document describes subscription access as the main entitlement. The runtime instead charges token-derived credits:

- `BillingConfig.tokens_per_credit`
- `process_usage_charge(...)`
- `process_service_charge(...)`

This means:

- subscribers can run out of balance even with an active subscription
- top-up balance acts as overage
- free usage is a credit bucket, not a question count

If the target model truly wants unlimited conversation for subscribed users, the current architecture needs a major redesign, not just new prices.

### 3. Free-tier behavior is much broader than the document

The policy says:

- only `روان‌یار`
- `2` free questions per day

The current code exposes multiple free agents, including:

- `ravanyar`
- `fal`
- `HAM-edalat`
- `HAM-moraje`
- `HAM-motalee`
- `HAM-shoghli`
- `HAM-tahsili`
- `vania-visitor-companion`

The free limit is enforced as `daily_free_credits`, currently `5.0`, not as question count.

### 4. Empathy credit is implemented in the opposite direction

The intended model says empathy credit should help non-subscribers continue after the free cap.

Today:

- top-up products are always visible and purchasable
- paid balance is stored in `balance_paid`
- free users cannot consume `balance_paid` unless they activate a plan

So the system allows users to buy credits they cannot use in the exact scenario where the document says they should be usable.

### 5. Social/gifting features are absent

The following concepts do not currently exist as first-class billing objects:

- gifted conversation
- empathy gift
- donor message storage
- regional allocation priority
- city-based targeting
- gift distribution and redemption
- capital ledger entries from gifts

These require new domain tables, not just UI.

### 6. Conversation capital currently conflicts with the spendable wallet model

In the document:

- conversation capital is a non-competitive, non-spendable profile metric

In the product today:

- the spendable wallet currency is branded as `سرمایه گفت‌وگو`

This naming collision is risky because the document gives “conversation capital” a symbolic meaning, while the code uses it as consumable credit.

### 7. Professional billing is modeled around profession bundles, not usage tiers

The current expert catalog is optimized around:

- profession eligibility
- agent bundle inclusion
- different prices per profession

The document wants:

- one professional pricing logic
- usage intensity tiers
- optional supercharge
- conversation-capital rules tied to tier state

This means the target model should probably separate:

- professional identity and eligibility
- professional subscription tier
- usage multiplier / overage tier
- feature access bundle

The current `SubscriptionPlan` model merges all of that into one object.

### 8. Payment operations are incomplete for the target direction

What works now:

- create invoice
- apply discount
- submit manual payment reference
- mark invoice paid and fulfill

What is incomplete:

- online gateway flow is effectively disabled in the frontend
- backend `InitiatePaymentView` does not start a gateway payment request properly
- there is no recurring billing
- there is no explicit consent state for auto-renew
- there is no tax calculation layer

### 9. Test billing is not present

The target says tests/assessments are separate add-ons with an IA analysis surcharge.

Current billing objects support only:

- plan activation
- raw credit top-up

There is no product type or fulfillment path for test purchases.

## Upgrade Recommendation

Do not try to patch the current system by only changing prices and labels. That would leave the core rules inconsistent.

Use a staged migration.

### Phase 0: Freeze the Canonical Policy

Before code changes, decide and document these unresolved business rules:

1. Are subscriptions unlimited, or quota-based?
2. Are public plans only monthly/yearly, or also 3/6 months?
3. Are expert plans profession-priced, or tier-priced, or both?
4. Is empathy credit:
   - a currency,
   - a message count,
   - or a token-metered balance?
5. Should `سرمایه گفت‌وگو` remain the spendable currency name, or should that name be reserved for the social metric?
6. Should general subscription grant access to all public agents, or exactly the documented subset?

Output of this phase should be a single canonical spec, ideally replacing the three sub-documents in `docs/billing.md`.

### Phase 1: Split Policy Concepts in the Data Model

Introduce separate domain concepts instead of overloading `UserWallet` and `SubscriptionPlan`.

Recommended new entities:

- `PriceBook`
- `PriceRule`
- `CurrencyDisplayRule`
- `SubscriptionProduct`
- `SubscriptionTier`
- `SubscriptionPeriod`
- `UserSubscription`
- `CreditBalance`
- `GiftProgram`
- `GiftAllocation`
- `ConversationCapitalEntry`
- `TestAddonProduct`
- `InvoiceLineItem`
- `TaxLineItem`

Key design rule:

- feature access, spendable balance, and social capital should not share one field or one label

### Phase 2: Redesign Entitlements

Move from “plan contains agents and credits” to a clearer entitlement model:

- subscriptions grant access rights
- empathy credit grants limited overflow usage for non-subscribers
- optional overage rules are explicit
- conversation capital is ledger-only and never spendable

Recommended entitlement checks:

1. Determine whether the user has an active subscription for the required audience/tier.
2. Determine whether the user is eligible by role/profession.
3. Determine whether the requested feature is part of the subscription.
4. If no active subscription:
   - allow only free-tier agents
   - use free question/message budget
   - then use empathy credit if present

This is simpler and closer to the policy than the current “wallet balance decides everything” model.

### Phase 3: Rebuild the Pricing Layer

Add a pricing resolver that starts from toman and computes display/payment amounts from a policy rule.

Required capabilities:

- base price stored in toman
- country/payment-method aware display currency
- `IRT / 1000` mapping if that rule remains approved
- fiat vs crypto payment method selection
- tax line item calculation
- discount and gift source tracking

This should live in a dedicated service, not be spread across product definitions and UI formatting.

### Phase 4: Rework Products and Invoices

Evolve `BillingProduct` from a dual-purpose object into typed commerce items.

Suggested product types:

- `PUBLIC_SUBSCRIPTION`
- `PROFESSIONAL_SUBSCRIPTION`
- `EMPATHY_CREDIT`
- `TEST_ADDON`
- `EMPATHY_GIFT`

Suggested invoice line types:

- `BASE_PRODUCT`
- `DISCOUNT`
- `GIFT_SOURCE`
- `TAX`
- `SURCHARGE`

This will make checkout, reporting, and accounting much easier.

### Phase 5: Migrate Current Users Safely

Recommended migration plan:

1. Snapshot all existing wallets and active plans.
2. Map current active plans into the closest new subscription SKU.
3. Decide how to handle `balance_paid`:
   - convert to empathy credit, or
   - keep as legacy wallet balance until depletion
4. Decide how to handle `balance_plan`:
   - expire on migration date, or
   - convert to temporary legacy balance with sunset rules
5. Backfill conversation capital entries from historical:
   - invoice payments
   - paid top-ups
   - future gifts
6. Keep legacy invoice history readable even if new invoice tables are introduced

### Phase 6: Update the UI and Language

The frontend should separate these concepts clearly:

- subscription status
- empathy credit balance
- gift participation
- conversation capital
- test add-ons

Specific UI changes needed:

- billing page should stop presenting spendable wallet balance as the main mental model if the product moves to subscription-first
- free-tier messaging should explicitly match the final rule set
- invoice page should show line items, tax, gift, and payment method state
- profile surfaces can show conversation capital as a separate, non-transactional metric

### Phase 7: Finish the Payment Ops

Regardless of the final policy, these operational fixes are needed:

1. implement a real `request_payment` flow in `InitiatePaymentView`
2. keep online payment either fully enabled or fully removed until ready
3. add explicit admin actions for approving manual payments
4. add recurring billing consent fields if auto-renew will exist
5. add tax calculation if VAT is part of the official policy

## Suggested Delivery Order

If the team wants the lowest-risk path, use this order:

1. Canonical billing spec
2. Naming cleanup: separate spendable credit from conversation capital
3. Empathy credit fix for non-subscribers
4. Free-tier scope correction
5. Pricing catalog rewrite
6. Professional tier rewrite
7. Gifts and capital ledger
8. Test add-ons
9. International pricing
10. recurring billing and tax

## Recommended First Implementation Slice

If we want a practical first milestone without boiling the ocean, the best first slice is:

1. make the public/free/subscription rules match the policy
2. stop requiring an active plan to spend non-subscriber overflow credit
3. narrow the free tier to the approved assistant set
4. rename the current spendable credit so conversation capital can become a separate concept later
5. unify the price book around the approved public and professional catalog

This would remove the biggest user-facing contradictions while keeping gifts, international pricing, and add-ons for later phases.

## Bottom Line

The current codebase is closer to a credit wallet with bundled access than to the subscription policy described in `docs/billing.md`.

If the goal is to move to the new approach described in the document, the main work is:

- separating subscription entitlement from spendable credit
- replacing profession-specific bundled plans with the approved public/professional catalog
- introducing first-class gift and conversation-capital ledgers
- adding a real pricing layer for international rules, taxes, and add-ons

Without that refactor, changing prices or UI copy alone will leave the platform behavior inconsistent with the intended billing model.

# Billing Access

Billing affects feature access, plan eligibility, credits, invoices, and demo restrictions.

## Key Paths

- `backend/definitions/billing.py`
- `backend/billing/models.py`
- `backend/billing/views.py`
- `backend/billing/services.py`
- `backend/services/access_service.py`
- `backend/services/usage.py`
- `backend/definitions/base.py`

## Access Objects

| Object | Purpose |
| --- | --- |
| `SubscriptionPlan` | Unlocks a set of agents and grants plan credits. |
| `BillingProduct` | Storefront item; may activate a plan or add paid credits. |
| `UserWallet` | Stores active plan and credit buckets. |
| `Transaction` | Audit log for deposits, spend, plan activation, and service charges. |
| `Invoice` | Checkout/payment record. |
| `DemoConfigDef` | Agent-level demo access, message limits, and canvas behavior. |

## Plan Audience

Plans have `audience`, `eligible_expert_professions`, `included_agent_slugs`, `included_credits`, and `is_active`.

Product listing and purchase both enforce `is_user_eligible_for_plan`.

## Current Plan Families

Current definitions include:

- visitor plans for public/all-audience agents
- lawyer expert plans
- psychiatrist expert plans
- psychologist expert plans
- general doctor expert plans

Expert plans include both general/all-audience agents and profession-specific expert agents.

## Wallet Rules

`UserWallet` has one active plan and two paid credit buckets:

- `balance_plan`: credits granted by plans
- `balance_paid`: top-up credits
- `daily_free_used`: daily free usage counter

Current code treats `active_plan is not None` as active. `plan_expires_at` is retained as a legacy compatibility field.

## Usage Charging

`process_usage_charge` follows this policy:

- Staff/admin users are unlimited.
- Active-plan users spend `balance_plan` first, then `balance_paid`.
- Free users spend only daily free credits.
- Free users with paid top-up balance still need an active plan to use that top-up balance.

`process_service_charge` follows the same plan/free split for service charges such as transcription.

## Fulfillment

When an invoice is paid, `FulfillmentService` activates linked plans, adds credits, records transactions, sends notifications where configured, and bumps the service access cache for plan activation.

Fulfillment rechecks plan eligibility before activating an ineligible plan.

## Expert Upgrade Credit Transfer

When a verified expert has existing credits, `activate_default_expert_plan_for_transferred_credits` can switch them to the matching expert plan without granting that plan's included credits. This keeps transferred credits usable after a visitor upgrades to expert.

## Demo Behavior

Demo access is per agent through `DemoConfigDef`:

- `access_mode`
- `model_override`
- `message_limit_scope`
- `message_limit_count`
- `canvas_mode`
- `canvas_placeholder_text`

Runtime access determines whether a user is in demo mode. The frontend should reflect demo state, but backend usage/runtime rules remain authoritative.

## Rules

- Billing restrictions must be enforced by backend logic.
- Product listing and direct purchase must both check plan eligibility.
- Access cache must be invalidated when a user's active plan changes.
- Keep plan definitions and agent profession eligibility aligned.

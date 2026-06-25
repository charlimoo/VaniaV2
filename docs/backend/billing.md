# Billing

The `billing` app owns plans, products, wallet balances, transactions, invoices, discounts, FAQ/config, payment callbacks, and credit deduction.

## Key Files

| File | Purpose |
| --- | --- |
| `backend/billing/models.py` | Billing config, plans, wallet, products, transactions, discounts, invoices |
| `backend/billing/views.py` | Storefront, purchase, invoice, discount, payment, FAQ endpoints |
| `backend/billing/services.py` | Credit charging and invoice fulfillment |
| `backend/billing/serializers.py` | Billing response contracts |
| `backend/billing/tasks.py` | Daily reset, stale invoice cleanup |
| `backend/billing/signals.py` | Invoice paid fulfillment trigger |
| `backend/definitions/billing.py` | Code-defined billing catalog |

## Main Models

- `BillingConfig`: global billing settings, daily free credits, token rate, support/payment config.
- `FAQ`: billing/support FAQ content.
- `SubscriptionPlan`: plan metadata, included credits, audience, eligible professions.
- `UserWallet`: user balances and active plan.
- `BillingProduct`: purchasable credit top-up or plan activation product.
- `Transaction`: wallet ledger entry.
- `DiscountCode`: discount rules and fund caps.
- `Invoice`: purchase/payment record.

## Routes

Mounted under `/api/billing/`:

| Route | Purpose |
| --- | --- |
| `config/` | Billing/support config |
| `faqs/` | FAQ list |
| `products/` | User-facing product list |
| `admin/products/` | Admin product list |
| `history/` | Transaction history |
| `purchase/` | Create invoice for product purchase |
| `invoices/<uuid:id>/` | Invoice details |
| `invoices/<uuid:invoice_id>/apply_discount/` | Apply discount |
| `pay/<uuid:invoice_id>/` | Initiate gateway payment |
| `callback/` | Zarinpal callback |
| `zibal/callback/` | Zibal callback |
| `pay/manual/<uuid:invoice_id>/` | Manual payment proof |

## Credit Charging

`process_usage_charge` deducts credits for agent token usage.

Rules:

- Staff/admin users are unlimited.
- If a plan is active, plan balance is used first, then paid balance.
- If no plan is active, only daily free credits are usable.
- Paid balance is intentionally ignored for users without an active plan.
- Partial deduction can occur when remaining credits are insufficient.

`process_service_charge` deducts credits for services such as transcription.

## Invoice Fulfillment

`FulfillmentService.execute(invoice)` handles paid invoices.

Rules:

- Fulfillment only runs for `PAID` invoices.
- Existing transaction with the invoice id prevents duplicate fulfillment.
- Linked plans activate/update wallet plan state and add included credits.
- Credit products add paid balance.
- Plan eligibility is checked before activation.
- Access cache is bumped when plan state changes.

## Payment Providers

Configured providers:

- Zarinpal through `ZARINPAL_MERCHANT_ID`, `ZARINPAL_SANDBOX`, `ENABLE_ZARINPAL`.
- Zibal through `ZIBAL_MERCHANT_ID`.
- Manual payment proof submission.

## Scheduled Jobs

Celery beat includes:

- `billing.tasks.reset_daily_free_credits`
- `billing.tasks.cancel_stale_invoices`

`clean_expired_plans` is kept as a deprecated no-op for old beat entries.

## Backend Rules

- Treat wallet updates as transactional.
- Keep the transaction ledger consistent with wallet balance changes.
- Check plan eligibility before plan activation.
- Bump access cache when active plan changes.
- Keep billing catalog changes in code definitions, then sync.

# Definitions Sync

Vania uses code-first definitions for important product data, then syncs those definitions into database records.

## Main File

- `backend/definitions/sync.py`

Definition objects live in:

- `backend/definitions/base.py`
- `backend/definitions/agents`
- `backend/definitions/billing.py`
- `backend/definitions/support.py`
- `backend/definitions/cities.json`

## Synced Definition Types

- Development admin user.
- Billing config.
- FAQs.
- Agent services.
- Service suggestions.
- Default canvas configs.
- Locations.
- Expert professions.
- Plans and products.
- Discounts.

## Sync Order

`DefinitionSync.sync_all()` runs:

1. `sync_admin_user()`
2. `sync_billing_config()`
3. `sync_faqs()`
4. `sync_agents()`
5. `sync_locations()`
6. `sync_expert_professions()`
7. `sync_plans_and_products()`
8. `sync_discounts()`

Most sync work runs inside one transaction after the admin user check.

## Agent Sync

Agent definitions are loaded from `backend/definitions/agents`.

Synced fields include:

- `slug`
- `name`
- `model_id`
- `description`
- `system_prompt`
- `capabilities`
- `tags`
- `user_guide`
- `is_public`
- `is_active`
- `is_free`
- `audience`
- `eligible_expert_professions`
- `requires_visitor_selector`
- `cost_multiplier`
- `enable_reasoning`
- `reasoning_effort`
- `static_tools`
- `extra_config`
- `demo_config`

Suggestions are deleted and recreated for each synced agent.

Default open canvas keys create or reuse `CanvasType` rows and create/update `AgentCanvasConfig`.

## Plan and Product Sync

Plans sync before products so products can link to plans.

Plan sync also sets the plan-to-agent many-to-many relation from `included_agent_slugs`.

## Idempotency Rules

- Sync must be safe to run repeatedly.
- Stable slugs and component keys are compatibility contracts.
- Removing definitions does not automatically delete all existing database records unless sync explicitly does so.
- Renaming a slug should be treated as a migration, not a simple edit.
- Agent suggestions are intentionally replaced on sync.

## Environment Variables

Admin bootstrap is controlled by:

- `SYNC_ADMIN_PHONE`
- `SYNC_ADMIN_PASSWORD`
- `SYNC_ADMIN_EMAIL`
- `SYNC_ADMIN_FULL_NAME`
- `FORCE_SYNC_ADMIN_PASSWORD`

Password reset behavior is conservative outside debug mode unless explicitly forced.

## Rules

- Add or update agents in code definitions first.
- Keep sync idempotent.
- Preserve stable slugs and keys unless a migration plan exists.
- Validate that synced records still match backend access rules and frontend expectations.
- After changing synced definitions, verify `/api/services/` output and affected access rules.

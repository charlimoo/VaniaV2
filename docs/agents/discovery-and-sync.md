# Discovery and Sync

Definitions and capabilities are discovered from code and synced into database records. This keeps product-critical metadata reviewable in source while still allowing runtime queries through Django models.

## Agent Discovery

Key file:

- `backend/definitions/agents/__init__.py`

Discovery rules:

- every non-private `.py` file in `backend/definitions/agents` is imported
- modules named `protocol` are skipped
- preferred export is `AGENTS = [AgentDef(...), ...]`
- fallback behavior collects top-level `AgentDef` instances
- duplicate slugs raise an error

Keep definition modules import-safe. Avoid network calls, database reads, or environment-dependent work during import.

## Agent Sync

Key file:

- `backend/definitions/sync.py`

`DefinitionSync.sync_agents()` updates:

- `AgentService.name`
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

It also replaces synced suggestions and associates `default_open_canvases`.

## Capability Discovery

Key file:

- `backend/capabilities/registry.py`

`CapabilityRegistry.autodiscover()` walks the `capabilities` package. Importing modules triggers decorators for capabilities, canvases, and form handlers.

This runs during Django startup and during the sync management command.

## Canvas Sync

`CapabilityRegistry.sync_to_db()` writes registered `BaseCanvas` classes into `CanvasType` rows:

- `component_key`
- `name`
- `slug`
- `description`
- `default_state`
- `schema_definition`

Agent sync can also create placeholder `CanvasType` rows for default canvas keys. Capability canvas registration should provide the real metadata.

## Sync Command

Run:

```bash
cd backend
python manage.py sync
```

The command:

1. Runs full definition sync.
2. Autodiscovers capabilities.
3. Syncs capability canvas definitions to the database.

## Slug Safety

Treat agent slugs as stable public/runtime identifiers. They can be referenced by:

- URLs
- session records
- billing plans
- service discovery
- frontend links
- runtime access checks
- fallback capability maps

Renaming a slug requires a migration plan.

## Sync Troubleshooting

If a service or canvas does not appear:

- confirm the module is not private and imports successfully
- confirm the module exports `AGENTS`
- confirm the capability decorator uses the same domain name as `AgentDef.capabilities`
- confirm canvas `component_key` matches `default_open_canvases`
- run `python manage.py sync`
- check logs for autodiscovery import errors

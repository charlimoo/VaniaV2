# Migrations

Canvas migrations are needed when changing component keys, state shape, renderer names, or permanent persistence behavior.

## Stable Keys

Treat `component_key` as a stable cross-layer contract. It appears in:

- backend `BaseCanvas`
- `CanvasType`
- `AgentCanvasConfig`
- `CanvasInstance`
- frontend `CanvasRegistry`
- `useCanvasStore`
- AG-UI `CanvasUpdateEvent`

Renaming a key without migration breaks existing sessions and renderer resolution.

## Safe State Shape Changes

Prefer additive changes:

- add optional fields
- keep old fields during transition
- have renderers tolerate missing fields
- rehydrate stale sessions from canonical domain data
- update TypeScript types after backend payload is defined

Avoid destructive changes to top-level state fields unless all persisted sessions can be migrated or ignored safely.

## Versioned Slugs

`CanvasType.slug` can be versioned, for example `vania-patient-manager-v1`. Use a new slug when the canvas type meaning changes significantly.

Do not assume changing the slug changes frontend renderer behavior. Renderer resolution uses `component_key`.

## Migration Paths

For a state shape migration, choose one of:

- tolerate both shapes in renderer code
- rehydrate from canonical Vania domain services
- write a data migration for `CanvasInstance.current_state`
- introduce a new `component_key` and renderer for a truly incompatible canvas

## Renderer Migration

If a renderer file is renamed, keep the old `component_key` mapped in `CanvasRegistry`.

If a backend key is renamed, keep a legacy key map until old sessions and database rows have been migrated.

## Persistence Migration

If user edits start changing a new durable domain field:

1. Add backend persistence before the canvas JSON merge.
2. Update capability hydration to read from the durable source.
3. Update tool refresh payloads.
4. Update frontend renderer behavior.
5. Add manual QA for refresh, reload, and old session behavior.

## Migration Checklist

- identify existing persisted `CanvasType` and `CanvasInstance` rows
- keep old renderer key mappings
- update backend defaults and hydration
- update frontend TypeScript types
- update all tool refresh payloads
- run sync
- manually load an old session and a new session

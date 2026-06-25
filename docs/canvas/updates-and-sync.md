# Updates and Sync

Canvas updates come from two directions: user edits in renderers and agent/tool updates during AG-UI runs.

## User Update Flow

```text
Renderer interaction
  -> onEdit(delta)
  -> useCanvasStore.updateCanvas(id, delta, source="USER")
  -> local deep merge
  -> PATCH /agent/canvas/instance/{id}
  -> backend permanent persistence hooks
  -> CanvasManager deep merge
  -> response with new state
```

The frontend PATCH includes context headers from the canvas store:

- `X-Target-Resource-ID`
- `X-Target-Expert-ID`
- `X-Target-Doctor-ID`
- `X-Target-Case-ID`

## Agent Update Flow

```text
Capability tool
  -> mutates domain data
  -> builds fresh canvas payload
  -> optionally persists CanvasInstance
  -> yields CanvasUpdateEvent
  -> AG-UI CUSTOM event
  -> useCanvasSync handles CANVAS_UPDATE
  -> useCanvasStore.updateCanvas(..., source="AGENT")
```

Agent updates do not echo back to PATCH. This prevents loops.

## Locking During Runs

`useCanvasSync` locks the canvas on `RUN_STARTED` and unlocks on `RUN_FINISHED` or `RUN_ERROR`.

This avoids user edits racing against tool-generated updates. Backend authorization and read-only checks are still required.

## Backend Merge Rules

`CanvasManager.deep_merge`:

- recursively merges objects
- overwrites arrays
- overwrites primitives
- rejects non-object patch payloads

The frontend store uses the same mental model.

## Permanent Persistence Hooks

`PATCH /agent/canvas/instance/{id}` persists known durable fields before updating canvas JSON.

Known hooks include:

- `cases` -> `CaseService.save_cases`
- `clinical_summary` -> `ProfileService.update_summary`
- `base_profile.form` -> `CaseService.save_base_profile`
- `patient_profile` -> `ProfileService.update_demographics`
- `forms_tests_analysis` -> `ProfileService.update_forms_tests_analysis`
- `medications` -> `MedicationService.save_plan`

If a new renderer edits durable domain state, add a backend hook or route. Do not rely only on session JSON.

## Read-Only Cases

For expert users, the update endpoint checks selected case access. If the selected case is read-only, it returns `403`.

Renderers should also disable write controls for `can_edit=false` or `is_read_only=true`, but backend enforcement is the real access control.

## Event Payload Rules

`CanvasUpdateEvent.value` should include:

- `canvas_id`
- `component_key`
- `delta`

Use `force_open` when the frontend should open the panel or focus the canvas. Use `meta` only when the frontend may need to create a missing instance.

## Sync Failure Behavior

The current frontend PATCH is background fire-and-forget and logs failures. For high-stakes edits, consider adding explicit UI error handling before relying on the edit as saved.

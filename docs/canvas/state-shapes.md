# State Shapes

Canvas state shapes are defined by backend canvas defaults, capability hydration payloads, and TypeScript contracts in `frontend/lib/types/vania.ts`.

## Shared Concepts

Both Vania canvases use:

- `is_active`
- `active_view`
- `active_tab`
- `base_profile`
- `cases`
- `selected_case_id`
- `selected_case`
- `available_forms`
- `ui_signal`
- profession policy fields such as `visible_tabs`, `case_overview_sections`, `allowed_form_keys`, `test_mode`, and `feature_policy`

`active_view` is usually:

- `BASE`: shared base profile view
- `CASES`: selected case/case list view

## Shared Base Profile

`base_profile` has:

```ts
{
  form: Record<string, any>;
  forms: any[];
  tests: ClinicalTestEntry[];
}
```

`BASE_PROFILE_V1` is shared between the visitor and linked experts. Non-base forms and tests are case/private according to Vania policy.

## Expert Canvas State

TypeScript interface:

- `PatientManagerState`

Backend key:

- `VANIA_PATIENT_MANAGER`

Important fields:

- `patient_profile`
- `base_profile`
- `cases`
- `selected_case_id`
- `selected_case`
- `tests_catalog`
- `available_forms`
- `visible_tabs`
- `case_overview_sections`
- `allowed_form_keys`
- `test_mode`
- `feature_policy`

`selected_case` follows `ExpertCaseState` and can include:

- case metadata
- read-only flags
- clinical summary
- summary voice notes
- forms/tests analysis
- roadmap data
- active goals
- appendix data
- medications
- rescue tasks
- forms
- tests
- files
- sessions

## Visitor Canvas State

TypeScript interface:

- `PatientJourneyState`

Backend key:

- `VANIA_PATIENT_JOURNEY`

Important fields:

- `base_profile`
- `cases`
- `selected_case_id`
- `selected_case`
- `my_doctors`
- `selected_doctor_id`
- `available_forms`
- `visible_tabs`
- `case_overview_sections`
- `allowed_form_keys`
- `test_mode`
- `feature_policy`

`selected_case` follows `VisitorCaseState` and can include:

- case metadata
- doctor metadata
- visible tabs
- greeting
- clinical summary
- current phase
- active goals
- tasks
- medications
- timeline
- library
- tests
- forms
- files
- forms/tests analysis

## Tab Values

Expert tabs:

- `CASE_OVERVIEW`
- `ROADMAP`
- `RESCUENET`
- `MEDICATIONS`
- `APPENDIX`
- `FILES`

Visitor tabs:

- `CASE_OVERVIEW`
- `RESCUENET`
- `MEDICATIONS`
- `TIMELINE`
- `LIBRARY`
- `FILES`

Visible tabs come from profession policy and should be treated as data, not hardcoded globally.

## Feature Policy

`feature_policy` controls visibility/availability of sections such as:

- clinical summary
- forms/tests analysis
- forms
- tests
- files
- medications
- rescue net
- appendix
- roadmap
- timeline
- library

Renderer logic should use both `visible_tabs` and `feature_policy`.

## Shape Change Rules

- Update backend default state.
- Update capability hydration payload.
- Update TypeScript types.
- Update renderers and tabs.
- Preserve old fields during transition when persisted sessions may contain them.
- Rehydrate stale sessions when a canonical persisted source changes.

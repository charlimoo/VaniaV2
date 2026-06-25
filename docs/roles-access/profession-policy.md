# Profession Policy

Profession policy controls what a verified expert can do inside Vania case workflows. It is separate from agent/plan eligibility.

## Key Path

- `backend/vania_core/profession_policy.py`

## Policy Outputs

Profession policy controls:

- expert canvas tabs
- visitor canvas tabs
- case overview sections
- allowed form definitions
- test mode
- allowed capability tool families
- feature policy flags
- prompt additions
- canvas policy payloads

## Current Policies

| Profession | Expert tabs | Visitor tabs | Notes |
| --- | --- | --- | --- |
| `psychiatrist` | `CASE_OVERVIEW`, `ROADMAP`, `MEDICATIONS` | `CASE_OVERVIEW`, `MEDICATIONS`, `TIMELINE` | Medication, forms, tests, roadmap; no files/rescue/appendix. |
| `psychologist` | `CASE_OVERVIEW`, `ROADMAP`, `RESCUENET`, `APPENDIX` | `CASE_OVERVIEW`, `RESCUENET`, `TIMELINE`, `LIBRARY` | Roadmap, rescue net, appendix, forms/tests; no medications/files. |
| `lawyer` | `CASE_OVERVIEW`, `FILES` | `CASE_OVERVIEW`, `FILES` | Summary and files; therapy/clinical test workflows disabled. |
| `general_doctor` | `CASE_OVERVIEW`, `FILES` | `CASE_OVERVIEW`, `FILES` | Summary, exams, files; therapy/medication/appendix workflows disabled. |

Unknown professions fall back to a restrictive policy.

## Tool Family Filtering

Vania expert and visitor tool factories map tool names to families, then filter by policy.

Examples of tool families:

- profiles
- case management
- clinical summary
- roadmap
- rescue net
- appendix
- medications
- forms
- tests
- files
- analysis

Filtering tools helps the model avoid unavailable actions. Tools still need backend permission checks.

## Forms and Tests

`resolve_allowed_form_keys` always allows `BASE_PROFILE_V1` and then applies profession-specific exclusions.

`test_mode` values include:

- `full_catalog`
- `exams_only`
- `disabled`

Renderer and tool behavior should honor these values.

## Canvas Policy Payload

Capabilities use policy helpers to build payloads containing visible tabs, allowed form keys, test mode, and feature policy flags. Frontend renderers should render from those payload fields instead of hardcoding profession behavior.

## Policy Change Checklist

When changing profession policy:

- update backend policy
- update capability prompt additions if behavior changes
- update tool family maps if new tools are affected
- update frontend renderer assumptions if new tabs or sections appear
- test the affected profession as both expert and visitor/case viewer

# Resource Access

Resource access controls which visitors, cases, files, forms, tests, and canvas state a user can read or mutate. This is separate from agent/plan eligibility.

## Key Paths

- `backend/vania_core/case_service.py`
- `backend/vania_core/permissions.py`
- `backend/vania_core/views.py`
- `backend/capabilities/vania_expert/tools.py`
- `backend/capabilities/vania_visitor/tools.py`
- `backend/canvas/routes.py`

## Treatment Connections

`TreatmentConnection` links an expert and visitor. Active connections determine which visitors an expert can browse and which cases can be shared in the workspace.

Connection states include pending, active, archived, and rejected flows.

## Case Ownership

Cases are stored per visitor and owner expert. Owner experts have edit access to their own cases.

`CaseService.get_accessible_cases_for_expert(patient, viewer_doctor)` returns owned cases and read-only shared cases, annotated with:

- `access_mode`
- `can_edit`
- `is_read_only`
- owner/doctor metadata
- share metadata

## Read-Only Sharing

`CaseAccessGrant` can grant read-only access to another expert. Current sharing rules include:

- case must exist
- grantee must be actively connected to the visitor
- grantee cannot be the owner expert
- grantee expert profession must match the owner profession when owner has a profession
- access mode is read-only

Backend write paths check `expert_can_edit_case` or equivalent scope resolution before mutation.

## Visitor Access

Visitors can access their own cases through `CaseService.get_accessible_cases_for_patient`.

Visitors see case data filtered for visitor view. Some data, such as medication plan, may be read-only for visitors and written by experts.

## Shared Base Profile

`BASE_PROFILE_V1` is the shared visitor base profile. It is visible across linked expert workflows and visitor workflows.

Non-base forms/tests are case/private according to viewer role, case ID, and submitting expert.

## Context Headers

Chat/canvas requests may include:

- `X-Target-Resource-ID`
- `X-Target-Visitor-ID`
- `X-Target-Patient-ID`
- `X-Target-Expert-ID`
- `X-Target-Doctor-ID`
- `X-Target-Case-ID`

Resource access code must normalize aliases but still validate ownership/sharing before exposing or mutating data.

## Resource Access Checklist

When changing resource behavior:

- verify active connection requirements
- verify owner expert edit behavior
- verify read-only expert behavior
- verify visitor self-access
- verify base profile sharing
- verify form/test visibility by viewer role
- verify canvas PATCH rejects forbidden mutations
- verify tools do not infer access from frontend context alone

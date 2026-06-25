# Context Headers

Several chat, canvas, service-debug, and Vania APIs are scoped to an active visitor/patient, expert/doctor, and case.

## Header Contract

Use these headers when a request needs active workspace context:

| Header | Purpose |
| --- | --- |
| `X-Target-Resource-ID` | Primary selected resource, usually visitor/patient ID. |
| `X-Target-Visitor-ID` | Visitor alias. |
| `X-Target-Patient-ID` | Patient alias. |
| `X-Target-Expert-ID` | Expert alias. |
| `X-Target-Doctor-ID` | Doctor alias. |
| `X-Target-Case-ID` | Active case ID. |
| `X-Active-Role` | Optional active role hint. |

## Query Aliases

Many endpoints also accept:

- `visitor_id`
- `patient_id`
- `expert_id`
- `doctor_id`
- `case_id`
- `resource_id`

Keep aliases compatible because both naming conventions still exist in frontend, backend, stored sessions, and links.

## Used By

Context is used by:

- `/agent/agui`
- `/agent/canvas/state/{session_id}`
- `/agent/canvas/instance/{instance_id}`
- `/api/services/debug-context/<slug>/`
- Vania case/profile/file/test endpoints

## Rules

- URL query params, headers, session state, and canvas store context should agree.
- Do not trust context IDs without backend ownership/access checks.
- For expert workflows, resource ID usually means selected visitor/patient.
- For visitor workflows, the authenticated user is often the resource.
- Case ID must be checked against owner/read-only sharing rules.

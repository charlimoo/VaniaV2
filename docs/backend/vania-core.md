# Vania Core

`vania_core` owns the domain model and APIs for Vania's expert/visitor workflows.

## Key Files

| File | Purpose |
| --- | --- |
| `backend/vania_core/models.py` | Domain models |
| `backend/vania_core/views.py` | Main domain API views |
| `backend/vania_core/urls.py` | `/api/vania/` routes |
| `backend/vania_core/serializers.py` | Domain serializers |
| `backend/vania_core/services.py` | Profile/domain service helpers |
| `backend/vania_core/case_service.py` | Case storage and access helpers |
| `backend/vania_core/task_service.py` | Task-related helpers |
| `backend/vania_core/medication_service.py` | Medication plan persistence |
| `backend/vania_core/profession_policy.py` | Profession-based form/test/tool policy |
| `backend/vania_core/esanj_views.py` | Esanj test integration |

## Main Models

- `RoleVerificationRequest`
- `Location`
- `DoctorProfile`
- `TreatmentConnection`
- `CaseAccessGrant`
- `PatientInvite`
- `Notification`
- `SecureMessage`
- `GoogleCalendarConnection`
- `ExpertMeetingLink`
- `PageTutorial`
- `EsanjTestAccessRule`
- `EsanjUserProfile`
- `EsanjTestAttempt`

## Route Groups

Mounted under `/api/vania/`.

Major workflows:

- Expert/visitor lookup and invitations.
- Connection requests and status.
- Public expert list and appointment requests.
- Notifications.
- Secure messages and meeting links.
- Expert profile.
- Visitor base profile.
- Case sharing.
- Tasks, sessions, medications.
- Case profile notes and voice notes.
- Roadmap, appendix, active session, session report.
- Clinical tests and files.
- Case files.
- Page tutorial matching.
- Google Calendar login/callback.
- Esanj test catalog, questionnaire, attempts, submit, sync.

## Context and Aliases

Many Vania Core endpoints accept both old and new terminology:

- doctor/expert
- patient/visitor

Scoped endpoints often read:

- query `case_id`
- header `X-Target-Case-ID`
- header `X-Target-Expert-ID`
- header `X-Target-Doctor-ID`
- header `X-Target-Resource-ID`

Keep compatibility unless doing a coordinated migration.

## Profession Policy

`profession_policy.py` controls profession-specific visibility and sanitization for forms, tests, tool families, and canvas payloads.

Use it when changing expert-specific behavior instead of hardcoding profession checks in UI components.

## Domain Services

Use domain services for durable state:

- `CaseService`
- `ProfileService`
- `MedicationService`
- task/session/profile helpers

Canvas tools and PATCH handlers should call these services when changes must survive beyond a session canvas.

## Backend Rules

- Backend access checks must protect expert/visitor relationships and case sharing.
- Do not assume every expert can view or edit every case.
- Preserve case-level permissions when canvas tools or PATCH routes mutate domain state.
- Keep Esanj payment/access behavior aligned with billing and profession policy.

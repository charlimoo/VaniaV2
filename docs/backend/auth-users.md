# Auth and Users

The `users` app owns authentication, role metadata, expert professions, profile context, OTP, and wallet/profile views exposed through `/api/auth/`.

## Key Files

| File | Purpose |
| --- | --- |
| `backend/users/models.py` | `CustomUser`, roles, expert professions, OTP requests, profile/context models |
| `backend/users/views.py` | Auth, signup, login, profile, expert verification endpoints |
| `backend/users/serializers.py` | User/profile/wallet serializer contracts |
| `backend/users/urls.py` | `/api/auth/` routes |
| `backend/users/roles.py` | Canonical role helpers and alias normalization |
| `backend/users/eligibility.py` | Agent and plan eligibility checks |
| `backend/users/otp_service.py` | OTP generation, cache storage, SMS dispatch |
| `backend/users/tasks.py` | Celery SMS tasks |
| `backend/users/expert_validation` | Profession-specific credential validation |

## Main Models

- `UserRole`: role metadata.
- `ExpertProfession`: expert profession/subtype definition and validation config.
- `CustomUser`: phone-authenticated user model with role and expert fields.
- `OTPRequest`: OTP audit/request record.
- `UserProfile`: additional profile data.
- `ContextDefinition`: reusable profile/context definition.
- `UserContextEntry`: structured user context entries used by profile/domain flows.

## Auth Routes

Mounted under `/api/auth/`:

| Route | Purpose |
| --- | --- |
| `request-otp/` | Send OTP |
| `verify-otp/` | Verify OTP |
| `complete-signup/` | Complete new user signup |
| `login/` | Password login |
| `profile/` | Current user profile |
| `profile/agent/` | Rich profile context for agent use |
| `change-password/` | Change password |
| `wallet/` | Current wallet summary |
| `check-exists/` | Phone existence check |
| `verify-doctor/` | Legacy expert verification alias |
| `verify-expert/` | Expert credential verification |
| `expert-professions/` | Profession list |
| `upgrade-expert/` | Visitor/user expert upgrade flow |
| `admin-expert-profession/` | Admin-only profession assignment |

## Role Rules

Canonical roles:

- `visitor`
- `expert`

Accepted aliases:

- `patient` -> `visitor`
- `doctor` -> `expert`

Important helper file:

- `backend/users/roles.py`

## Eligibility Rules

Agent and plan eligibility live in:

- `backend/users/eligibility.py`

Rules:

- Staff/admin users are eligible for all agents and plans.
- `ALL` audience is available to all users.
- `VISITOR` audience is available to visitors and experts with visitor features.
- `EXPERT` audience requires expert role and verified expert status.
- Expert profession lists restrict eligible experts when present.

## Expert Upgrade Flow

Expert upgrade uses:

- Profession definitions synced by `DefinitionSync.sync_expert_professions`.
- Credential validation service under `users/expert_validation`.
- Optional billing behavior that activates a default expert plan for transferred credits.

Rules:

- Expert profession is not a cosmetic field. It affects service visibility, plan eligibility, and canvas/tool policy.
- Do not bypass expert verification in product logic except for staff/admin.

## OTP and SMS

OTP and SMS dispatch use:

- Cache for OTP verification state.
- Celery tasks when enabled.
- Console/SMS provider behavior controlled by `SMS_SERVICE_MODE`.

SMS variables:

- `SMS_SERVICE_MODE`
- `SMSIR_API_KEY`
- `SMSIR_TEMPLATE_ID`
- `SMSIR_PARAMETER_NAME`
- `NAJVA_API_KEY`
- `NAJVA_SENDER_ID`

## Backend Rules

- Normalize phone numbers before lookup.
- Keep user-facing auth errors localized for product use.
- Do not trust frontend role selection. Always read the authenticated user and backend role fields.
- Preserve role aliases until all backend/frontend/session code is migrated together.

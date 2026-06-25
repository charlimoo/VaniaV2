# Expert Verification

Expert verification controls whether a user can access expert-only agents, expert-only plans, expert capabilities, and profession-scoped workflows.

## Key Paths

- `backend/users/views.py`
- `backend/users/expert_validation.py`
- `backend/users/models.py`
- `backend/vania_core/models.py`
- `backend/vania_core/signals.py`
- `backend/definitions/sync.py`

## Profession Definitions

`DefinitionSync.sync_expert_professions()` creates active `ExpertProfession` rows for:

| Slug | Validation kind |
| --- | --- |
| `psychologist` | `real_psychologist` |
| `psychiatrist` | `manual_psychiatrist` |
| `lawyer` | `real_lawyer` |
| `general_doctor` | `manual_general_doctor` |

The validation config contains product-facing labels, placeholders, help text, and any sample or accepted codes.

## Profession Endpoint

`GET /api/auth/expert-professions/` returns active professions and credential UI metadata.

This powers expert signup and upgrade forms.

## Verification Endpoints

`POST /api/auth/verify-doctor/` and `POST /api/auth/verify-expert/` validate credentials without necessarily changing the signed-in user's role.

`POST /api/auth/upgrade-expert/` is the authenticated role upgrade path. It:

1. validates profession slug and national code
2. validates credential code through the profession validator
3. creates or finds the canonical expert role
4. writes profession and verification metadata
5. marks the user verified immediately when manual review is not required
6. creates a pending `RoleVerificationRequest` when manual review is required
7. activates a default expert plan for transferred credits when applicable

## Manual Review

`RoleVerificationRequest` stores pending, approved, and rejected expert claims.

When an admin approves a request, `vania_core.signals.process_role_approval`:

- sets the user role
- sets `is_expert_verified=True`
- syncs legacy doctor fields
- stores profession and verification metadata
- creates a `DoctorProfile` when appropriate
- sends a notification
- may activate a default expert plan for transferred credits

When rejected, the signal marks verification metadata as rejected and clears verified flags.

## Admin Profession Bypass

`POST /api/auth/admin-expert-profession/` lets staff/admin users set their own active expert profession and mark themselves verified. This is an internal/admin path.

## Access Consequence

Expert-only agents and expert-only plans require:

- canonical role `expert`
- `is_expert_verified=True`
- matching `expert_profession.slug` when the agent or plan has profession constraints

Having an `expert_profession` without verification is not enough.

## Verification Checklist

When changing verification:

- check automatic and manual-review professions
- check profile serialization
- check service discovery for expert-only agents
- check billing product visibility
- check plan purchase rejection for ineligible users
- check access cache after plan/role changes

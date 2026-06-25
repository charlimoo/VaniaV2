# Role Model

The role model is intentionally small: a user has a primary `UserRole`, optional `ExpertProfession`, and verification fields. Product behavior is built from those fields plus plan/resource state.

## Models

Key file:

- `backend/users/models.py`

Important models:

| Model | Purpose |
| --- | --- |
| `UserRole` | Canonical role tag such as `visitor` or `expert`. |
| `ExpertProfession` | Canonical expert profession with validation configuration. |
| `CustomUser` | User identity, role, expert verification, and profile fields. |
| `UserWallet` | Billing/access state, created for every user. |
| `UserProfile` | Generic profile preferences, created for every user. |

## CustomUser Fields

Role/access-relevant fields:

- `role`
- `expert_profession`
- `is_expert_verified`
- `expert_verified_at`
- `expert_verification_meta`
- `is_verified_doctor`
- `medical_license`
- `national_code`
- `is_staff`
- `is_superuser`
- `is_active`

`is_verified_doctor` and `medical_license` are legacy compatibility fields. Prefer `expert_profession` and `is_expert_verified` for new access logic.

## Created Dependencies

`backend/users/signals.py` creates a `UserProfile` and `UserWallet` when a `CustomUser` is created.

Do not assume a missing wallet/profile is normal for a persisted user; code may still call `get_or_create` defensively.

## Profile Serialization

`UserSerializer` exposes normalized fields:

- `role_slug`
- `role_label`
- `is_expert_verified`
- `expert_profession_slug`
- `expert_profession_label`
- `expert_verification_status`
- `expert_verification_message`
- `wallet`

Frontend role behavior should use these normalized fields rather than raw database relation details.

## Staff and Admin

Staff/admin users are privileged. Backend helpers treat them as eligible for expert and visitor feature checks. They can also access admin product catalogs and bypass normal service access restrictions.

Keep staff/admin behavior explicit in docs and tests because it can hide bugs in normal role gating.

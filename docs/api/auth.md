# Auth APIs

Auth APIs live under:

```text
/api/auth/
```

They handle OTP/password login, signup completion, profile loading, wallet detail, password changes, role/profession metadata, and expert upgrades.

## Endpoint Table

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/check-exists/` | Public | Check whether a phone number already has an account. |
| `POST` | `/api/auth/request-otp/` | Public | Request an OTP for a phone number. |
| `POST` | `/api/auth/verify-otp/` | Public | Verify OTP and receive tokens or signup token. |
| `POST` | `/api/auth/complete-signup/` | Public | Complete signup with signup token, name, email, password. |
| `POST` | `/api/auth/login/` | Public | Password login. |
| `GET` | `/api/auth/profile/` | Bearer | Current user profile. |
| `PATCH` | `/api/auth/profile/` | Bearer | Update current user profile. |
| `GET/PATCH` | `/api/auth/profile/agent/` | Bearer | Generic user profile detail. |
| `POST` | `/api/auth/change-password/` | Bearer | Change or set password. |
| `GET` | `/api/auth/wallet/` | Bearer | Current wallet summary. |
| `GET` | `/api/auth/expert-professions/` | Public | Active expert professions and credential UI config. |
| `POST` | `/api/auth/verify-doctor/` | Public | Validate expert credential. |
| `POST` | `/api/auth/verify-expert/` | Public | Alias for credential validation. |
| `POST` | `/api/auth/upgrade-expert/` | Bearer | Upgrade authenticated user to expert or submit manual review. |
| `POST` | `/api/auth/admin-expert-profession/` | Staff/admin | Admin profession selection shortcut. |

## OTP Flow

Typical flow:

```text
POST /api/auth/check-exists/
POST /api/auth/request-otp/
POST /api/auth/verify-otp/
```

If the phone belongs to an existing user, OTP verification returns auth tokens and user data. If signup is required, the flow uses a signed signup token and finishes through `complete-signup`.

## Password Login

`POST /api/auth/login/` accepts:

```json
{
  "phone_number": "09...",
  "password": "..."
}
```

It returns the same token/profile shape used by OTP login.

## Profile Contract

`GET /api/auth/profile/` returns normalized role and expert fields:

- `id`
- `phone_number`
- `email`
- `full_name`
- `wallet`
- `is_staff`
- `is_superuser`
- `role_label`
- `role_slug`
- `national_code`
- `medical_license`
- `is_verified_doctor`
- `is_expert_verified`
- `expert_profession_slug`
- `expert_profession_label`
- `expert_verification_status`
- `expert_verification_message`
- `expert_verification_requested_at`
- `expert_verification_can_retry`
- `has_password`

Frontend guards should use these normalized values.

## Expert Upgrade

`POST /api/auth/upgrade-expert/` requires a bearer token and accepts profession/credential data. It may immediately approve the user or create a pending manual review request.

Expert-only agents and plans require `role_slug="expert"` plus `is_expert_verified=true`.

## Frontend Consumers

Key consumers:

- `frontend/components/providers/user-provider.tsx`
- `frontend/lib/api.ts`
- `frontend/lib/roles.ts`
- dashboard settings/profile pages
- auth landing/signup flows

## Error Notes

Common statuses:

- `400`: invalid phone, OTP, signup token, password, credential, profession, or national code
- `401`: missing/invalid token for protected endpoints
- `403`: admin-only action requested by non-admin
- `429`: throttled OTP/login flow

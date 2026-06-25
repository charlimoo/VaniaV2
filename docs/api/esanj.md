# Esanj APIs

Esanj APIs are under:

```text
/api/vania/esanj/
```

They integrate interactive psychological/exam tests with Vania attempts and result workflows.

## Endpoint Table

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/vania/esanj/tests/` | Bearer | List accessible Esanj tests. |
| `POST` | `/api/vania/esanj/tests/sync/` | Bearer/admin-sensitive | Sync Esanj tests from upstream/config. |
| `GET` | `/api/vania/esanj/tests/{test_id}/questionnaire/` | Bearer | Fetch questionnaire payload. |
| `GET` | `/api/vania/esanj/attempts/` | Bearer | List attempts. |
| `POST` | `/api/vania/esanj/attempts/` | Bearer | Create/start an attempt. |
| `GET` | `/api/vania/esanj/attempts/{attempt_id}/` | Bearer | Read attempt detail/result. |
| `PATCH` | `/api/vania/esanj/attempts/{attempt_id}/` | Bearer | Update attempt state. |
| `POST` | `/api/vania/esanj/attempts/{attempt_id}/submit/` | Bearer | Submit attempt answers/result. |

## Access Rules

Access depends on user role, profession, test access rules, assigned attempts, and case context where applicable.

## Consumers

Esanj endpoints are used by:

- Vania test dashboard surfaces
- canvas test tabs
- expert tools assigning/reviewing interactive tests
- visitor tools listing direct attempts

## Notes

When changing Esanj APIs, verify both case-linked tests and direct account-owned attempts. Visitor agents are expected to check direct attempts even when no case is active.

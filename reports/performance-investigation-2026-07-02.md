# Production Performance Investigation - 2026-07-02

## Production backup

- Created before code changes.
- Server: `185.83.181.198`
- Container: `db-x5mg958sncqbspvqk0wu0baf-085734933670`
- File: `/root/vania-db-backups/vania_db_prod_20260702T103707Z.dump`
- Format: `pg_dump -Fc --no-owner --no-acl`
- Size: `279M`
- SHA256: `e1519edaeb009bcaaa5137b5954a3945f6c6f3dfcac100a2dd88a80488f45d33`

## Key production findings

- Older expert user inspected: `09209781191`
- User id: `14`
- Role: `expert`
- User session count: `438`
- User canvas instance count: `362`
- Total `ai.agent_sessions.runs` JSONB size for this user: about `1700 MB`
- Largest observed `runs` rows: `145 MB`, `96 MB`, `71 MB`, `47 MB`, `42 MB`
- Canvas state is much smaller: about `16 MB` total, max `107 KB`
- Production indexes on `ai.agent_sessions` before this change:
  - `session_id`
  - `created_at`
  - `session_type`
- Missing index relevant to old-user loading:
  - `(user_id, session_type, created_at DESC)`

## Root cause

`/agent/sessions` used Agno storage `get_sessions(...)`, which materializes full session objects before sorting and paginating in Python. Full session rows include the large `runs` JSONB field, so older users can force the backend to read and deserialize hundreds of megabytes or more just to render a lightweight dashboard/sidebar session list.

Fresh users do not see the same slowdown because they have fewer sessions and much smaller `runs` payloads.

## Changes applied

### Backend

- File: `backend/agents/routes.py`
- Added a PostgreSQL metadata-only fast path for `GET /agent/sessions`.
- The fast path selects only:
  - `session_id`
  - `agent_id`
  - `session_data`
  - `created_at`
- It intentionally does not select `runs`, `agent_data`, `team_data`, `workflow_data`, or other heavy JSON columns.
- Added optional server-side `agent_id` filtering for chat sidebars.
- Kept the existing Agno storage path as a fallback for non-PostgreSQL/local setups.

### Database schema

- File: `backend/services/migrations/0009_agent_session_metadata_index.py`
- Added a safe conditional index migration:
  - `idx_agent_sessions_user_type_created_at`
  - columns: `(user_id, session_type, created_at DESC)`
- The migration checks whether `ai.agent_sessions` or `agent_sessions` exists before creating the index.
- This changes schema/indexes only; it does not modify existing user data.

### Frontend

- File: `frontend/lib/SimpleThreadAdapters.ts`
- Chat thread listing now sends `agent_id` to `/agent/sessions`.
- This avoids fetching generic recent sessions and filtering by agent only in the browser.

## Data safety

- No old session rows were edited.
- No `runs` JSON was cleaned or truncated.
- No production data mutation was performed beyond writing the backup file on the server filesystem.
- The performance fix is designed to leave historical data untouched and avoid reading heavy historical payloads for metadata lists.

## Validation

- `python3 -m py_compile backend/agents/routes.py backend/services/migrations/0009_agent_session_metadata_index.py`: passed
- Python AST parse for changed backend files: passed
- `./node_modules/.bin/tsc --noEmit` from `frontend/`: passed
- `pnpm exec tsc --noEmit`: blocked by local Corepack signature/key metadata before TypeScript started
- `backend/.venv/bin/python backend/manage.py check`: blocked by local Python/Homebrew `pyexpat` dynamic library mismatch while importing `pypdf`, before changed code was exercised

## Follow-up after stage deploy

- Test `panel.stage.vaniaapp.app` dashboard for an older expert account.
- Test chat sidebar for an agent with many historical sessions.
- Test opening a very large old chat thread separately; this change optimizes session lists, but opening a specific old thread can still be slow if that thread's own `runs` payload is very large.
- If thread opening remains slow, next safe change should optimize `GET /agent/sessions/{session_id}` to avoid unnecessary session object serialization. Data cleanup of historical `runs` should only happen after explicit approval.

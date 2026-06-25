# Canvas APIs

Canvas APIs live under:

```text
/agent/canvas/
```

They are FastAPI routes mounted inside the agent runtime.

## Endpoint Table

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/agent/canvas/state/{session_id}` | Bearer | Hydrate canvas instances for a chat session. |
| `PATCH` | `/agent/canvas/instance/{instance_id}` | Bearer | Persist user-originated canvas delta. |

## Hydration

`GET /state/{session_id}` accepts:

- `agent_id`
- `visitor_id` / `patient_id`
- `expert_id` / `doctor_id`
- `case_id`

It also reads context headers. It returns:

```json
{
  "session_id": "...",
  "canvases": [
    {
      "id": "...",
      "name": "...",
      "slug": "...",
      "component_key": "VANIA_PATIENT_MANAGER",
      "current_state": {},
      "is_visible": true
    }
  ]
}
```

Hydration may refresh stale state when selected case, selected doctor, or canonical base profile changes.

## Update

`PATCH /instance/{instance_id}` accepts:

```json
{
  "delta": {}
}
```

The backend persists known permanent Vania changes before merging session canvas JSON:

- cases
- clinical summary
- base profile
- patient profile
- forms/tests analysis
- medications

Read-only expert case edits return `403`.

## Frontend Consumers

- `frontend/lib/canvas/useCanvasSync.ts`
- `frontend/lib/canvas/store.ts`
- `frontend/components/canvas/CanvasPanel.tsx`

## Related Docs

See the Canvas section for state shapes, migration rules, and renderer contracts.

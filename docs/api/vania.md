# Vania APIs

Vania APIs live under:

```text
/api/vania/
```

They power expert/visitor relationships, case work, messages, notifications, roadmap, appendix, tasks, sessions, medications, tests, files, and profile state.

## Relationship and Directory APIs

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/doctors/` | Bearer | Expert directory for authenticated users. |
| `GET` | `/experts/` | Bearer | Alias for expert directory. |
| `POST` | `/doctors/{doctor_id}/request/` | Bearer | Visitor requests appointment/connection. |
| `POST` | `/experts/{doctor_id}/request/` | Bearer | Alias for expert request. |
| `GET` | `/my-patients/` | Expert | Expert dashboard patients. |
| `GET` | `/my-visitors/` | Expert | Expert dashboard visitors alias. |
| `POST` | `/patients/invite/` | Expert | Expert invites patient. |
| `POST` | `/visitors/invite/` | Expert | Alias for visitor invite. |
| `POST` | `/patients/lookup/` | Expert | Expert patient lookup. |
| `POST` | `/visitors/lookup/` | Expert | Alias for visitor lookup. |
| `GET` | `/requests/` | Bearer | Visitor connection requests. |
| `POST` | `/requests/{connection_id}/respond/` | Bearer | Visitor responds to request. |
| `POST` | `/my-patients/requests/{connection_id}/respond/` | Expert | Expert responds to request. |
| `POST` | `/my-visitors/requests/{connection_id}/respond/` | Expert | Alias for expert response. |
| `POST` | `/my-patients/{connection_id}/status/` | Expert | Activate/deactivate patient connection. |
| `POST` | `/my-visitors/{connection_id}/status/` | Expert | Alias for visitor connection status update. |

## Profile and Case Sharing APIs

| Method | Path | Purpose |
| --- | --- | --- |
| `GET/PATCH` | `/my-profile/` | Expert profile. |
| `GET/PATCH` | `/my-base-profile/` | Visitor shared base profile. |
| `GET` | `/cases/{case_id}/share-options/` | Case share options. |
| `POST` | `/cases/{case_id}/shares/` | Grant read-only case access. |
| `DELETE` | `/cases/{case_id}/shares/{expert_id}/` | Revoke case share. |

## Notifications and Messages

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/notifications/` | List notifications. |
| `POST` | `/notifications/{pk}/read/` | Mark one notification read. |
| `POST` | `/notifications/read-all/` | Mark all notifications read. |
| `GET` | `/messages/inbox/` | Conversation list. |
| `GET/POST` | `/messages/{other_user_id}/` | Message thread. |
| `POST` | `/messages/{other_user_id}/create-meet/` | Create Google Meet link. |

## Case Operating APIs

| Method | Path | Purpose |
| --- | --- | --- |
| `GET/POST/PUT/DELETE` | `/roadmap/` | Roadmap fetch and mutation. |
| `POST` | `/roadmap/active/` | Set active roadmap session. |
| `POST` | `/roadmap/report/` | Finalize/manage session report. |
| `GET/POST/PATCH` | `/appendix/` | Thought appendix resources. |
| `POST/PUT/DELETE` | `/tasks/manage/` and `/tasks/manage/{task_id}/` | Rescue task create/update/delete. |
| `POST/PUT/DELETE` | `/medications/` and `/medications/{medication_id}/` | Medication create/update/delete. |
| `POST/PUT/DELETE` | `/sessions/manage/` and `/sessions/manage/{entry_id}/` | Session log management. |
| `GET/PUT/POST/DELETE` | `/case-profile/` | Case summary/profile notes and voice notes. |

## Tests and Files

| Method | Path | Purpose |
| --- | --- | --- |
| `GET/POST` | `/tests/` | List/create clinical tests. |
| `PUT/DELETE` | `/tests/{test_id}/` | Update/delete clinical test. |
| `POST` | `/tests/{test_id}/file/` | Upload test file. |
| `DELETE` | `/tests/{test_id}/file/delete/` | Delete test file. |
| `GET` | `/tests/{test_id}/file/download/` | Download test file. |
| `GET/POST` | `/case-files/` | List/upload case files. |
| `GET/DELETE` | `/case-files/{file_id}/` | Read/delete case file metadata. |
| `GET` | `/case-files/{file_id}/download/` | Download case file. |

## Miscellaneous

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/role-verification/` | Generic role verification request. |
| `POST` | `/my-tasks/{task_id}/complete/` | Visitor completes a task. |
| `GET` | `/locations/` | Location list. |
| `GET` | `/page-tutorials/match/` | Match tutorial content for page path. |
| `GET` | `/google-calendar/login/` | Calendar OAuth start. |
| `GET` | `/google-calendar/callback/` | Calendar OAuth callback. |

## Access Rules

Most Vania APIs require authentication. Many are additionally role, connection, case, and profession scoped.

Do not call these APIs with only frontend trust. Backend must verify active relationship, case ownership, read-only grants, and profession policy.

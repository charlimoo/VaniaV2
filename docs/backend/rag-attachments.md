# RAG and Attachments

Vania supports static agent knowledge bases and per-session uploaded file knowledge.

## Key Files

| File | Purpose |
| --- | --- |
| `backend/services/models.py` | `KnowledgeBase`, `KnowledgeDocument` |
| `backend/services/rag_service.py` | Qdrant knowledge helpers, ingestion, search, rendering |
| `backend/services/tasks.py` | Background document ingestion |
| `backend/agents/routes.py` | Attachment prepare/delete endpoints |
| `backend/agents/stream.py` | Retrieved session file context injection |
| `backend/agents/factory.py` | Static/session knowledge initialization |
| `backend/agents/session_metadata.py` | Session knowledge flags and file counts |

## Static Knowledge

Static knowledge uses:

- `KnowledgeBase`
- `KnowledgeDocument`
- Qdrant collection derived from the knowledge base name

Agents can attach knowledge bases through the `AgentService.knowledge_bases` many-to-many relation.

When no session knowledge is active, the agent factory can initialize static knowledge for the service.

## Session Knowledge

Session knowledge is tied to a chat session id.

Collection name:

- `session_<session_id>` with sanitization through `get_session_knowledge_collection_name`

Attachment endpoints:

- `POST /agent/attachments/prepare`
- `DELETE /agent/attachments/{attachment_id}`

Supported attachment behavior:

- Images are accepted for multimodal agent input.
- PDFs are ingested into session knowledge.
- Unsupported file types or oversized files are rejected.

## Stream Integration

During streaming:

1. UI attachment metadata is persisted into session data.
2. If the session has knowledge and the user prompt exists, retrieved file context is rendered.
3. The agent receives a system instruction to use `search_knowledge_base` for uploaded-file questions.

## Qdrant

Qdrant settings:

- `QDRANT_URL`
- `QDRANT_API_KEY`

Embedding model:

- `text-embedding-3-small`

The OpenAI-compatible client uses the configured AI provider.

## Storage

Knowledge document files may live on local disk or S3/MinIO depending on `USE_S3`.

`rag_service` handles local and remote file access during document ingestion.

## Background Ingestion

`services.tasks.ingest_document` processes `KnowledgeDocument` rows and updates status:

- `PENDING`
- `PROCESSING`
- `COMPLETED`
- `FAILED`

`services.tasks.reset_stuck_documents` marks stale processing documents as failed.

## Backend Rules

- Keep session knowledge separate from static agent knowledge.
- Update session knowledge metadata when adding or removing uploaded PDFs.
- Do not answer uploaded-file questions without retrieval when session knowledge is active.
- Make ingestion failures visible through `KnowledgeDocument.status` and `error_message`.

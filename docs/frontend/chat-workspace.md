# Chat Workspace

The chat workspace is where users interact with agents and collaborate through canvas state. It sits at the intersection of service discovery, thread/session persistence, AG-UI streaming, attachments, billing/demo access, role context, and responsive layout.

## Key Files

- `frontend/app/(chat)/chat/[agentId]/[threadId]/page.tsx`
- `frontend/app/(chat)/chat/layout.tsx`
- `frontend/components/chat`
- `frontend/components/assistant-ui`
- `frontend/lib/ag-ui`
- `frontend/lib/SimpleThreadAdapters.ts`
- `frontend/lib/canvas`

## Responsibilities

- Resolve the active agent from the route.
- Fetch service metadata from `/api/services/`.
- Create or restore a backend thread/session.
- Initialize the custom AG-UI runtime.
- Preserve visitor/expert/case context in query params.
- Forward context to backend headers and session state.
- Hydrate and sync canvas state.
- Render chat, tools, attachments, and canvas side by side.
- Handle draft versus persisted threads.
- Apply demo/preview access and locked canvas behavior.
- Adapt mobile and desktop layouts.

## Layout Shell

`frontend/app/(chat)/chat/layout.tsx` creates the authenticated chat shell. It uses two sidebar providers:

- The outer dashboard rail renders `DashboardSidebar` on the right.
- The inner chat rail renders `ChatSidebar`, offset beside the dashboard rail.
- `ChatLayoutProvider` owns chat-specific layout state.

The layout redirects unauthenticated users to the auth entry and keeps the chat workspace visually separate from the regular dashboard.

## Route Parameters

The chat page route is:

```text
/chat/[agentId]/[threadId]
```

`agentId` is the service slug used for service discovery and runtime requests. `threadId` may refer to an existing persisted session or a draft thread flow that is created on first message.

## Context Aliases

The chat UI must preserve compatibility with both naming conventions:

- `visitorId` and `patientId`
- `expertId` and `doctorId`
- `caseId`

These values may appear in query params, session state, and backend headers. Do not remove aliases unless the backend, persisted sessions, and all links are migrated together.

## Context Forwarding

Runtime calls may forward scoped context through:

- `X-Target-Resource-ID`
- `X-Target-Visitor-ID`
- `X-Target-Patient-ID`
- `X-Target-Expert-ID`
- `X-Target-Doctor-ID`
- `X-Target-Case-ID`
- `X-Active-Role`

Keep query params, request headers, and session state aligned. Expert/visitor workflows rely on restoring the same selected visitor, expert, and case after refresh or navigation.

## Thread Lifecycle

The chat page uses the adapters in `frontend/lib/SimpleThreadAdapters.ts` to list, create, rename, delete, and hydrate sessions through `/agent/sessions`.

The adapter also builds backend session state with both old and new alias names. That compatibility is intentional because backend and frontend code still contain both naming conventions.

## Attachments

Attachments are handled by the frontend adapter before the message is sent:

- Images are compressed client-side before upload/runtime submission.
- PDFs are prepared through `POST /agent/attachments/prepare`.
- Prepared attachments can be removed through `DELETE /agent/attachments/{attachment_id}`.
- Attachment metadata is persisted with the relevant thread/session.

The current composer limits should be checked in `frontend/lib/SimpleThreadAdapters.ts` before changing the UI picker.

## Demo and Preview Behavior

Service metadata can include access status, ownership, demo config, UI config, and supported canvases. The chat workspace should honor these values in presentation, but backend runtime access remains authoritative.

Locked or preview canvas states should use the shared canvas lock behavior instead of custom page-local rules.

## Mobile Behavior

Mobile layouts differ from desktop. When changing the chat page, verify:

- chat-only view
- canvas-only or canvas-focused view
- sidebar opening and closing
- composer height and attachment previews
- long assistant responses
- locked canvas overlays

## Failure and Recovery

Expected failure states include missing service metadata, unauthorized service access, failed session hydration, interrupted AG-UI streams, attachment validation failures, and canvas hydration errors.

The chat UI should surface actionable errors while preserving already-loaded thread and canvas state wherever possible.

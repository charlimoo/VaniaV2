# AG-UI Runtime

The AG-UI frontend runtime connects Assistant UI components to the backend FastAPI agent runtime. It owns streaming, cancellation, message conversion, custom events, session persistence, and attachment-aware message sending.

## Key Files

- `frontend/lib/ag-ui/useAgUiRuntime.ts`
- `frontend/lib/ag-ui/runtime/AgUiThreadRuntimeCore.ts`
- `frontend/lib/SimpleThreadAdapters.ts`
- `frontend/components/assistant-ui`
- `frontend/components/chat`

## Runtime Hook

`useAgUiRuntime` creates an external store runtime for `@assistant-ui/react`. It:

- creates an `AgUiThreadRuntimeCore`
- loads history through thread adapters
- merges runtime adapters
- exposes the runtime to Assistant UI components

Keep this hook focused on runtime composition. Feature-specific behavior usually belongs in adapters, event handlers, or page-level wiring.

## Thread Runtime Core

`AgUiThreadRuntimeCore` builds and runs AG-UI requests. It:

- creates run IDs
- converts Assistant UI messages into AG-UI input
- forwards agent ID, thread ID, state, tools, context, and runtime props
- streams through `HttpAgent.runAgent`
- persists user and assistant messages through the history adapter
- cancels active runs through abort signals and `/agent/runs/{runId}/cancel`

The core also handles important custom events:

| Event | Frontend behavior |
| --- | --- |
| `assistant_output_complete` | Completes the latest assistant message |
| `billing_required` | Opens billing-required UI |
| other custom events | Passed through the runtime aggregation path |

Canvas-specific AG-UI custom events are consumed by the canvas sync hook.

## Thread Adapters

`frontend/lib/SimpleThreadAdapters.ts` owns the practical bridge between UI state and backend sessions:

- list sessions
- get messages
- read thread metadata
- create backend sessions
- rename sessions
- delete sessions
- prepare and remove attachments
- build session state with role/context aliases

This is the first place to inspect when chat history, titles, attachments, or context restoration behave incorrectly.

## Attachments

The adapter supports image and PDF attachment flows:

- Images are compressed in the browser before being attached to the run.
- PDFs are prepared by the backend so they can be ingested into session knowledge.
- Attachment removal calls the backend with the thread ID.

Attachment size, count, and accepted file rules live in the adapter. Keep composer UI limits aligned with those constants.

## Cancellation

Cancelling a run must do two things:

1. Abort the active client-side stream.
2. Notify the backend run cancellation endpoint.

This prevents the UI from continuing to stream and gives the backend a chance to stop work or mark the run as cancelled.

## Runtime Change Checklist

When changing runtime behavior, verify:

- existing thread history loads
- new draft thread creation works
- cancellation stops streaming
- billing-required events still open the correct UI
- attachments still prepare and remove correctly
- canvas update events still reach `useCanvasSync`
- context aliases remain in session state and headers

# Demo and Access

Canvas visibility and write behavior depends on agent access, demo config, runtime lock state, role, profession policy, and case-level edit permissions.

## Demo Modes

`DemoConfigDef.canvas_mode` controls canvas behavior for users without full access:

| Mode | Behavior |
| --- | --- |
| `HIDDEN` | Canvas should not be shown. |
| `LOCKED` | Canvas can render but is covered by an upgrade/lock overlay. |
| `OPEN` | Canvas is interactive in demo mode. |

The frontend passes `demoConfig` to `CanvasPanel`, which decides whether to lock the canvas in preview/demo mode.

## Runtime Lock

During an active AG-UI run, `useCanvasSync` sets the canvas store lock.

The panel shows sync/lock state and renderers receive `isLocked=true`. This is a race-prevention UX lock, not an authorization mechanism.

## Case Read-Only Access

Expert selected cases may include:

- `can_edit: false`
- `is_read_only: true`

Renderers should disable mutating controls for read-only cases. The backend update endpoint also checks access and returns `403` for forbidden edits.

## Profession Policy

Profession policy controls:

- visible tabs
- case overview sections
- allowed form keys
- test mode
- feature policy flags

Do not show hidden tabs or form/test actions just because the renderer can technically render them.

## Backend Authority

Frontend hiding, locking, and disabled buttons are UX. Backend routes and tools must enforce:

- authenticated user
- visitor/expert role
- resource ownership or sharing
- case edit permission
- profession restrictions
- billing/demo runtime access

## Access Checklist

When changing canvas access behavior:

- test a full-access user
- test a locked/demo user
- test an expert owner case
- test an expert read-only shared case
- test a visitor-owned case
- test profession-specific hidden tabs/actions
- verify backend rejects forbidden PATCHes

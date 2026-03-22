# Capability Review Index

This folder contains a review-only audit of the two Vania capability packages:

- `backend/capabilities/vania_expert`
- `backend/capabilities/vania_visitor`

Files:

- `vania_expert_report.md`
- `vania_visitor_report.md`

## Cross-Capability Summary

### Overall verdict

- `vania_expert`: `improved after remediation`
- `vania_visitor`: `improved after remediation`

Both capabilities are structurally sound: they hydrate canvas state, expose a usable tool surface, and respect the centralized profession policy model. The main problems are parity gaps between AI tools and manual canvas actions, plus prompt vocabulary gaps where English capability text does not fully anchor important Persian UI labels.

### Strong points

- Capability state contracts are clearly case-scoped vs shared-base scoped.
- Profession policy is centralized in `backend/vania_core/profession_policy.py` and reused for tool filtering plus canvas sanitization.
- Expert read-only shared cases are consistently guarded in most mutating expert tools and manual endpoints.
- Backend/frontend canvas keys and initial state shapes are aligned for both canvases.

### Cross-cutting issues

- Several manual canvas actions do not have AI tool parity.
- Some AI tools support persisted mutations that the current manual canvas only performs optimistically or locally.
- Capability prompt additions are mostly explanatory, but they still encode a few workflow hints that may be better moved into agent system prompts if you want capabilities to stay purely descriptive.
- Persian UI terminology is only partially grounded in capability prompts; many labels are discoverable indirectly from form titles and returned data, but not all high-importance tab names are explicitly mapped.

### Highest-signal findings

1. Expert roadmap parity is now mostly closed: AI tools support active-session selection and session deletion; manual-only local reorder remains the main leftover mismatch.
2. Expert test/file parity is improved: the AI tool surface can now attach existing case files to tests and remove attachments through the shared case-file workflow.
3. Visitor case-sharing parity was fixed: AI tools now cover share-option discovery plus read-only grant/revoke flows.
4. Visitor library completion mismatch was fixed: the visitor library tab now persists consumed state through the backend appendix path.
5. Expert medication parity issue was fixed: the manual medications tab now uses explicit persisted backend mutations.

### Scope note

This audit separates:

- capability-level concerns
- manual canvas/backend parity concerns
- agent system prompt concerns

If a behavior is primarily dictated by the agent definitions in `backend/definitions/agents`, it is called out as agent-level context rather than treated as a pure capability defect.

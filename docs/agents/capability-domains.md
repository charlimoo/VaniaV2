# Capability Domains

Capability domains are technical names used in `AgentDef.capabilities` and `AgentService.capabilities`. They decide which tools, prompts, canvases, and context hooks an agent receives.

## Current Domains

| Domain | Main file | Purpose |
| --- | --- | --- |
| `core` | `backend/capabilities/core/capability.py` | Generic utility and generative UI tools. |
| `vania_visitor` | `backend/capabilities/vania_visitor/capability.py` | Visitor-facing case, journey, task, test, file, expert, and profile behavior. |
| `vania_expert` | `backend/capabilities/vania_expert/capability.py` | Expert-facing visitor/case management, forms, tests, roadmap, medications, files, and profile behavior. |

## Core

The `core` capability provides:

- calculator toolkit
- chart UI tool
- data table UI tool
- media card UI tool
- option list UI tool
- prompt guidance for when to use UI tools

Use it for generic structured chat UI. It does not own Vania domain state.

## Vania Visitor

The `vania_visitor` capability provides:

- visitor profile context
- active expert context
- accessible cases
- case snapshot and journey loading
- case selection
- task completion
- resource consumption
- session reflection
- medication read-only view
- test result inspection
- direct interactive test inspection
- case sharing controls
- case file listing/search/reading
- `VANIA_PATIENT_JOURNEY` initial canvas state

Visitor tools are filtered by the active case's expert profession policy, with direct account test tools handled specially.

## Vania Expert

The `vania_expert` capability provides:

- expert profile context
- active visitor profile context
- accessible visitor and case browsing
- visitor/case selection
- case creation, renaming, and deletion
- clinical summary updates
- roadmap and session report management
- rescue-net task management
- appendix/resource prescription
- medication management
- clinical form schema and submission
- clinical test management and attachment reading
- case file listing/search/reading
- forms/tests analysis updates
- `VANIA_PATIENT_MANAGER` initial canvas state

Expert tools are filtered through `vania_core.profession_policy`.

## Profession Policy

Key file:

- `backend/vania_core/profession_policy.py`

Profession policy controls:

- visible expert tabs
- visible visitor tabs
- allowed form keys
- allowed tests
- allowed tool families
- feature policy flags
- prompt additions
- canvas policy payloads

When behavior differs for psychologist, psychiatrist, lawyer, or general doctor, check profession policy before changing tools or canvases.

## Domain Selection Rules

Use `vania_visitor` for visitor-owned workflows. Use `vania_expert` for expert workflows that operate on a selected visitor/case. Use `core` for generic UI tools that do not depend on Vania case state.

Avoid attaching both visitor and expert capabilities to one normal product agent unless the agent is intentionally cross-role and all tools enforce role/resource checks.

## Domain Change Checklist

When modifying a domain:

- check the agent definitions that reference it
- check prompt additions for stale tool contracts
- check tool family policy
- check canvas state shape
- check frontend renderers
- run sync if canvases changed
- verify both service discovery and runtime behavior

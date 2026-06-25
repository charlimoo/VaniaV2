---
layout: doc
title: Vania Developer Docs
---

# Vania Developer Docs

This documentation site is organized for engineers who build, debug, extend, and operate Vania V2.

## Recommended Reading Order

1. [Local Development](/getting-started/local-development) to run the project.
2. [Repository Tour](/getting-started/repository-tour) to understand where code lives.
3. [System Overview](/architecture/system-overview) to learn the main platform concepts.
4. [Agent Definitions](/agents/agent-definitions), [Capability System](/agents/capability-system), and [Canvas Contract](/canvas/canvas-contract) for the core collaboration model.
5. [Testing Strategy](/quality/testing-strategy) before changing shared runtime, role, or canvas behavior.

## Main Sections

- **Start Here**: setup, repository layout, common commands.
- **Architecture**: system boundaries, request flows, persistence, cross-service concepts.
- **Backend**: Django APIs, agent runtime, code-first definitions, background services.
- **Frontend**: Next.js app, chat workspace, dashboard surfaces, shared UI contracts.
- **Agents and Capabilities**: agent metadata, capability registration, tools, forms, prompt/context hooks.
- **Canvas**: backend canvas state, frontend renderers, sync behavior, compatibility rules.
- **Roles and Access**: visitor/expert behavior, profession filtering, billing and demo restrictions.
- **API**: exposed API groups and request conventions.
- **Operations**: environment variables, local infrastructure, deployment notes.
- **Quality**: tests, manual QA checklists, troubleshooting.
- **Contributing**: coding and documentation standards.

## Documentation Rules

- Keep developer-facing docs in English.
- Keep product UI copy in Persian when documenting examples from screens.
- Prefer exact paths and contracts over vague descriptions.
- Update docs when changing agent definitions, capability contracts, canvas keys, role rules, or API behavior.

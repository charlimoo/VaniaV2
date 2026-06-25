# Coding Standards

Follow the existing architecture and local patterns before introducing new abstractions.

## General Rules

- Keep contributor communication and docs in English.
- Keep product UI copy in Persian.
- Put agent metadata in `backend/definitions/agents`.
- Put capability behavior in `backend/capabilities`.
- Enforce role and billing rules on the backend.
- Preserve visitor/patient and expert/doctor aliases unless a coordinated cleanup exists.
- Keep canvas backend keys and frontend renderers aligned.

## Frontend Rules

- Use existing components and design conventions.
- Validate with `pnpm exec tsc --noEmit`.
- Check responsive chat/canvas behavior when affected.

## Backend Rules

- Keep access and eligibility logic backend-owned.
- Prefer capability-based extension points.
- Run relevant tests for auth, roles, services, runtime, and canvas changes.

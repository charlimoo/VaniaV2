# Local Development

Use this page as the source of truth for running Vania locally.

## Prerequisites

- Windows development environment
- Python virtual environment for `backend/`
- `pnpm` for `frontend/` and `docs/`
- Docker for local infrastructure services

## Common Commands

Frontend:

```bash
cd frontend
pnpm install
pnpm dev
pnpm exec tsc --noEmit
```

Backend:

```bash
cd backend
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
pytest
```

Docs:

```bash
cd docs
pnpm install
pnpm dev
```

## VS Code Tasks

The repository includes VS Code tasks for infrastructure, backend, Celery, frontend, and VitePress docs. Use `Start Docs (VitePress)` to run this site on port `3001`.

## What To Document Next

- Required environment variables
- Service startup order
- Local accounts and seed data
- Common setup failures and fixes

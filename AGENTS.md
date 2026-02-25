use pnpm for frontend and venv for backend.
frontend: pnpm lint script fails due current Next CLI setup (next lint no longer valid in this config). USE: pnpm exec tsc --noEmit

dont check git status for changes, there might be many unrelated uncommitted stuff that confuse you. let the user handle git commits themselve.
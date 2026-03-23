# TaskMe — AI-Powered Task Management

## Project Structure
- `backend/` — FastAPI + SQLModel + PostgreSQL (Python 3.13)
- `frontend/` — React 19 + Vite + Tailwind CSS

## Development Setup
- Backend: `cd backend && source venv/Scripts/activate && uvicorn app.main:app --reload`
- Frontend: `cd frontend && npm run dev`

## Testing
- Backend (97 tests): `cd backend && source venv/Scripts/activate && python -m pytest tests/ -v`
- Frontend (64 tests): `cd frontend && npx vitest run`
- Pre-commit hook at `.git/hooks/pre-commit` runs both automatically

## Testing Conventions
- Backend fixtures in `backend/tests/conftest.py` — use `client`, `user_a`, `user_b`, `session`
- Frontend mocks API modules with `vi.mock('../../api/...')`
- Frontend context tests use TestConsumer pattern with renderWithProviders

## Rules
- Always run relevant tests after making code changes
- Never commit if tests fail
- Use sessionStorage (not localStorage) for auth tokens
- The columnconfig unique constraint is (user_id, workspace_id, field_key)

## Skills (always follow)
These skills define core development discipline. Read and follow the referenced file when the situation applies.

- **Verification before completion** — Never claim work is done without running the verification command and reading the output first. No "should pass" or "looks correct". Evidence before claims. See `.claude/skills/verification-before-completion/SKILL.md`
- **Systematic debugging** — When encountering any bug or test failure: find root cause before attempting fixes. No guess-and-check. Four phases: investigate → analyze patterns → hypothesis → implement. See `.claude/skills/systematic-debugging/SKILL.md`
- **Test-driven development** — Write a failing test first, watch it fail, write minimal code to pass. No production code without a failing test. See `.claude/skills/test-driven-development/SKILL.md`
- **Receiving code review** — Verify feedback technically before implementing. No performative agreement ("You're absolutely right!"). Push back with reasoning if wrong. See `.claude/skills/receiving-code-review/SKILL.md`

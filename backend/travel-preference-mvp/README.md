# Travel Preference MVP — API Bundle

Clean export for attaching a **separate UI** to the FastAPI backend.

## What this is

- `category_agent/` — TripProfile, Likert DNA, chat, industries, Seoul Places find
- `app/main.py` — HTTP API (`/api/*`); `app/static/` is optional demo UI (safe to ignore)
- `pyproject.toml` / `uv.lock` — dependencies
- `scripts/run_demo.ps1` — local uvicorn helper
- `tests/` — unit tests (no live keys required for most)
- `.env.example` — **variable names only**; copy to `.env` and fill locally

## Integration docs (Korean)

Read these in the Cursor Project store (not duplicated here in full):

- Master overview: `docs/mvp-overview.md`
- UI integration / API contract: `docs/ui-integration-guide.md`
- File list for this zip: `docs/api-bundle-manifest.md`

Absolute store docs root (this machine):
`C:\Users\semin\AppData\Local\Cursor\AgentStores\cursor_agent_stores\bc-f697f031-e73b-4c7c-8d37-f8a4af0ddb54\files\docs\`

## Quick start

```powershell
cd <this-folder>
Copy-Item .env.example .env
# Edit .env: GOOGLE_PLACES_API_KEY, VERTEXAI_*, optional CORS_ALLOW_ORIGINS
# Vertex auth: gcloud auth application-default login
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8765
```

Health: `GET http://127.0.0.1:8765/api/health`

## Not included (by design)

- `.env` / API keys / ADC credentials
- `data/mvp_store` personal runs
- Smoke JSON dumps with run history
- `.venv`, `__pycache__`, `.git`

## CORS

Set `CORS_ALLOW_ORIGINS` (comma-separated) for a separate frontend origin.
Empty = CORS middleware disabled.

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
# Edit .env: GEMINI_API_KEY, KAKAO_REST_API_KEY, optional CORS_ALLOW_ORIGINS
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8765
```

Health: `GET http://127.0.0.1:8765/api/health`

The default LLM is Gemini Developer API `gemini-3.5-flash-lite` using `v1beta`; set
`GEMINI_MODEL` to another model available to your key if necessary. Kakao Local
keyword search supplies place names, addresses, coordinates, categories and IDs.
It does not supply Google ratings or review counts. Seoul results use an address
check, not an administrative boundary dataset; missing/unrecognized addresses
are excluded. TourAPI remains optional. Existing API paths remain unchanged.
Google's free tier and model availability depend on the project and quota; see
https://ai.google.dev/gemini-api/docs/pricing.

TourAPI's existing `searchKeyword2` adapter uses `TOUR_API_KEY` or
`DATA_GO_KR_SERVICE_KEY`, accepts either portal key form, and requests Seoul
(`areaCode=1`). It checks the service result code and excludes records without
a Seoul address, usable coordinates or content ID. Without a key it is skipped.
Candidate merging retains source IDs and identifies cross-source matches by
normalized name plus nearby coordinates or matching address. Lodging categories
are excluded unless explicitly requested in `must_have`; convention venues are
also excluded unless event intent is explicit. As in the original
pipeline, `must_have` otherwise boosts matching candidates rather than requiring
every result to match; `must_avoid` excludes matches. Address and name matching
are heuristics, not official geographic boundaries or identity verification.

## Not included (by design)

- `.env` / API keys / ADC credentials
- `data/mvp_store` personal runs
- Smoke JSON dumps with run history
- `.venv`, `__pycache__`, `.git`

## CORS

Set `CORS_ALLOW_ORIGINS` (comma-separated) for a separate frontend origin.
Empty = CORS middleware disabled.

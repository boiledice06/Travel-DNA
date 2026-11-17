# API Bundle Manifest

Transferable export for a separate UI.  
**Folder:** `C:\Users\semin\travel-preference-mvp\dist\api-bundle\`  
**Zip:** `C:\Users\semin\travel-preference-mvp\dist\travel-preference-mvp-api-bundle.zip`

Guides: [mvp-overview.md](./mvp-overview.md) · [ui-integration-guide.md](./ui-integration-guide.md)

## Counts

| Item | Value |
|------|-------|
| Files in folder / zip | **41** |
| Excluded | `.env`, ADC, `.venv`, `__pycache__`, `data/mvp_store`, smoke/run JSON dumps, `.git` (repo has none) |

## Included files

```text
.env.example
.gitignore
README.md
pyproject.toml
uv.lock
app/__init__.py
app/main.py
app/static/index.html
category_agent/__init__.py
category_agent/cli.py
category_agent/dna.py
category_agent/dna_chat.py
category_agent/likert.py
category_agent/llm/__init__.py
category_agent/llm/base.py
category_agent/llm/factory.py
category_agent/llm/vertex.py
category_agent/pipeline.py
category_agent/recommend.py
category_agent/schemas.py
category_agent/search/__init__.py
category_agent/search/__main__.py
category_agent/search/cli.py
category_agent/search/places_client.py
category_agent/search/schemas.py
category_agent/search/seoul_find.py
category_agent/search/service.py
category_agent/search/tourapi.py
category_agent/seoul_run.py
category_agent/store.py
category_agent/trip_profile.py
data/sample-dna.json
scripts/batch_industry_test.py
scripts/run_demo.ps1
scripts/smoke_shipped_flow.py
tests/test_dna_chat.py
tests/test_nl_pipeline.py
tests/test_recommend.py
tests/test_search.py
tests/test_seoul_find.py
tests/test_trip_profile.py
```

## Notes

- Bundle `README.md` points at this store’s integration docs (absolute path on 세민’s machine).
- `app/static/index.html` is optional demo UI — separate frontends can ignore it.
- `CORS_ALLOW_ORIGINS` is documented in `.env.example`; middleware activates only when set.
- After unpack: copy `.env.example` → `.env`, set keys locally, run `uv sync` then uvicorn.

"""FastAPI: TripProfile form + DNA chat + industry plan (Seoul MVP)."""
from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from category_agent.dna_chat import (
    DnaChatConstraintsRequest,
    DnaChatFinalizeRequest,
    DnaChatLikertRequest,
    DnaChatMessageRequest,
    finalize_dna_chat,
    get_dna_chat,
    send_dna_chat_message,
    start_dna_chat,
    submit_constraints,
    submit_likert,
)
from category_agent.llm.upstream import ModelFailure
from category_agent.search.photo_enrichment import PhotoRequest, PhotoResult, enrich_photos
from category_agent.search.photo_sources import photo_health
from app.singleflight import run_once
from category_agent.pipeline import run_nl_pipeline
from category_agent.recommend import plan_industries
from category_agent.schemas import IndustryPlanRequest, NlPipelineRequest
from category_agent.search import places_configured, search_places
from category_agent.search.schemas import PlacesSearchRequest
from category_agent.seoul_run import SeoulRunRequest, discovery_health, run_seoul_pipeline
from category_agent.store import get_profile, save_profile
from category_agent.trip_profile import TripProfileCreate

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

os.environ.setdefault("VERTEXAI_PROJECT", "bright-anagram-505514-h2")
os.environ.setdefault("VERTEXAI_LOCATION", "global")
os.environ.setdefault("VERTEXAI_MODEL", "gemini-3.8-flash")
os.environ.setdefault("TRAVEL_MVP_LLM_PROVIDER", "gemini")


def _cors_allow_origins() -> list[str]:
    """Comma-separated origins for a separate UI. Empty = CORS middleware off."""
    raw = (os.getenv("CORS_ALLOW_ORIGINS") or "").strip()
    if not raw:
        return []
    return [part.strip() for part in raw.split(",") if part.strip()]


app = FastAPI(title="Travel Preference MVP", version="0.9.0")
_log = logging.getLogger("uvicorn.error")


@app.exception_handler(ModelFailure)
def model_failure_response(_request: Request, exc: ModelFailure) -> JSONResponse:
    status = 429 if exc.code == "model_rate_limit" else 503 if exc.transient else 502
    return JSONResponse({"detail": {"code": exc.code, "retryable": exc.transient}}, status_code=status)


@app.post("/api/place-photos", response_model=list[PhotoResult])
def api_place_photos(body: PhotoRequest) -> list[PhotoResult]:
    return enrich_photos(body)


_cors_origins = _cors_allow_origins()
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

static_dir = Path(__file__).resolve().parent / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.get("/", response_class=HTMLResponse)
def index() -> HTMLResponse:
    return HTMLResponse((static_dir / "index.html").read_text(encoding="utf-8"))


@app.get("/api/health")
def health() -> dict:
    adc = Path(os.environ.get("APPDATA", "")) / "gcloud" / "application_default_credentials.json"
    return {
        "ok": True,
        "mode": "seoul_taste_place_finder",
        "city_default": "서울",
        "trip_profile": "form_only_logistics",
        "must_avoid": "dna_session_free_text",
        "must_have": "dna_session_free_text",
        "travel_dna": "likert_then_chat",
        "place_finding": True,
        "itinerary": False,
        "region_agnostic": True,
        "default_total_slots": 16,
        "llm_provider": os.getenv("TRAVEL_MVP_LLM_PROVIDER", "gemini"),
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY", "").strip()),
        "gemini_model": os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite"),
        "vertex_project": os.getenv("VERTEXAI_PROJECT") or os.getenv("GOOGLE_CLOUD_PROJECT"),
        "vertex_location": os.getenv("VERTEXAI_LOCATION") or os.getenv("GOOGLE_CLOUD_LOCATION"),
        "vertex_model": os.getenv("VERTEXAI_MODEL", "gemini-3.8-flash"),
        "adc_file_present": adc.exists(),
        "places_configured": places_configured(),
        "discovery": discovery_health(),
        "place_photos": photo_health(),
        "nl_pipeline": True,
        "survey_deferred": True,
    }


# ----- TripProfile (form) -----


@app.post("/api/trip-profile")
def api_save_trip_profile(body: TripProfileCreate) -> JSONResponse:
    try:
        profile = save_profile(body.to_profile())
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return JSONResponse(profile.model_dump())


@app.get("/api/trip-profile/{profile_id}")
def api_get_trip_profile(profile_id: str) -> JSONResponse:
    profile = get_profile(profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="profile not found")
    return JSONResponse(profile.model_dump())


# ----- TravelDNA chat -----


@app.post("/api/dna-chat/start")
def api_dna_chat_start() -> JSONResponse:
    try:
        result = start_dna_chat()
    except (ModelFailure, HTTPException):
        raise
    except Exception as exc:
        _log.warning("backend upstream failure exception_type=%s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="upstream request failed") from None
    return JSONResponse(result.model_dump())


@app.post("/api/dna-chat/likert")
def api_dna_chat_likert(body: DnaChatLikertRequest) -> JSONResponse:
    try:
        result = submit_likert(body)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (ModelFailure, HTTPException):
        raise
    except Exception as exc:
        _log.warning("backend upstream failure exception_type=%s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="upstream request failed") from None
    return JSONResponse(result.model_dump())


@app.post("/api/dna-chat/message")
def api_dna_chat_message(
    body: DnaChatMessageRequest,
    idempotency_key: str = Header(default="", alias="Idempotency-Key", max_length=100),
) -> JSONResponse:
    try:
        result = run_once("chat", body.session_id, body.model_dump_json(),
                          lambda: send_dna_chat_message(body), replay=idempotency_key)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (ModelFailure, HTTPException):
        raise
    except Exception as exc:
        _log.warning("backend upstream failure exception_type=%s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="upstream request failed") from None
    return JSONResponse(result.model_dump())


@app.post("/api/dna-chat/constraints")
def api_dna_chat_constraints(body: DnaChatConstraintsRequest) -> JSONResponse:
    try:
        result = submit_constraints(body)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (ModelFailure, HTTPException):
        raise
    except Exception as exc:
        _log.warning("backend upstream failure exception_type=%s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="upstream request failed") from None
    return JSONResponse(result.model_dump())


@app.post("/api/dna-chat/finalize")
def api_dna_chat_finalize(body: DnaChatFinalizeRequest) -> JSONResponse:
    try:
        result = finalize_dna_chat(body)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (ModelFailure, HTTPException):
        raise
    except Exception as exc:
        _log.warning("backend upstream failure exception_type=%s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="upstream request failed") from None
    return JSONResponse(result.model_dump())


@app.get("/api/dna-chat/{session_id}")
def api_dna_chat_get(session_id: str) -> JSONResponse:
    try:
        session = get_dna_chat(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return JSONResponse(session.model_dump())


# ----- Join: Seoul run -----


@app.post("/api/seoul-run")
@app.post("/api/seoul-find")
def api_seoul_run(body: SeoulRunRequest) -> JSONResponse:
    """Profile + DNA → industries → Seoul place shortlist (places on by default)."""
    try:
        result = run_once("find", f"{body.profile_id}:{body.dna_session_id}",
                          body.model_dump_json(), lambda: run_seoul_pipeline(body))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (ModelFailure, HTTPException):
        raise
    except Exception as exc:
        _log.warning("backend upstream failure exception_type=%s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="upstream request failed") from None
    return JSONResponse(result.model_dump())


# ----- Legacy NL / numeric DNA -----


@app.post("/api/nl-pipeline")
def api_nl_pipeline(body: NlPipelineRequest) -> JSONResponse:
    try:
        result = run_nl_pipeline(body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (ModelFailure, HTTPException):
        raise
    except Exception as exc:
        _log.warning("backend upstream failure exception_type=%s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="upstream request failed") from None
    return JSONResponse(result.model_dump())


@app.post("/api/industry-plan")
def api_industry_plan(body: IndustryPlanRequest) -> JSONResponse:
    try:
        result = plan_industries(body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (ModelFailure, HTTPException):
        raise
    except Exception as exc:
        _log.warning("backend upstream failure exception_type=%s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="upstream request failed") from None
    return JSONResponse(result.model_dump())


@app.post("/api/recommend")
def api_recommend_alias(body: IndustryPlanRequest) -> JSONResponse:
    return api_industry_plan(body)


@app.post("/api/places-search")
def api_places_search(body: PlacesSearchRequest) -> JSONResponse:
    if not places_configured():
        raise HTTPException(
            status_code=503,
            detail="KAKAO_REST_API_KEY not set",
        )
    try:
        result = search_places(body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (ModelFailure, HTTPException):
        raise
    except Exception as exc:
        _log.warning("backend upstream failure exception_type=%s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="upstream request failed") from None
    return JSONResponse(result.model_dump())

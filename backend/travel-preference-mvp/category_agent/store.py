"""Simple JSON file store for TripProfile + DNA chat sessions (MVP)."""
from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Optional, TypeVar

from pydantic import BaseModel

from .trip_profile import TripProfile

T = TypeVar("T", bound=BaseModel)

_LOCK = threading.Lock()
_ROOT = Path(__file__).resolve().parents[1] / "data" / "mvp_store"
_PROFILES = _ROOT / "profiles"
_SESSIONS = _ROOT / "dna_sessions"


def _ensure_dirs() -> None:
    _PROFILES.mkdir(parents=True, exist_ok=True)
    _SESSIONS.mkdir(parents=True, exist_ok=True)


def save_profile(profile: TripProfile) -> TripProfile:
    _ensure_dirs()
    path = _PROFILES / f"{profile.id}.json"
    with _LOCK:
        path.write_text(profile.model_dump_json(indent=2), encoding="utf-8")
    return profile


def get_profile(profile_id: str) -> Optional[TripProfile]:
    _ensure_dirs()
    path = _PROFILES / f"{profile_id}.json"
    if not path.exists():
        return None
    return TripProfile.model_validate_json(path.read_text(encoding="utf-8"))


def save_session_dict(session_id: str, payload: dict) -> None:
    _ensure_dirs()
    path = _SESSIONS / f"{session_id}.json"
    with _LOCK:
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def load_session_dict(session_id: str) -> Optional[dict]:
    _ensure_dirs()
    path = _SESSIONS / f"{session_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))

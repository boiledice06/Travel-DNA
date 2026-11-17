"""NL likes/dislikes → numeric Travel DNA via ChatModel (Vertex by default)."""
from __future__ import annotations

import json
import re
from typing import Optional

from .llm import ChatModel, LlmMessage, get_chat_model
from .schemas import PreferenceAxes, TourismPillars, TravelDNA

_SYSTEM = """Extract Travel DNA numbers from free-text travel likes/dislikes.
Return JSON only — no essays.

Schema:
{
  "pillars": {"do_play":0-1,"see_learn":0-1,"stay_vibe":0-1,"eat_local":0-1},
  "axes": {
    "authenticity": -1..1,
    "energy": -1..1,
    "density": -1..1,
    "novelty": -1..1,
    "setting": -1..1
  },
  "micro_keywords": ["short tags"]
}

Rules:
- pillars must sum to 1.0
- axes: authenticity landmark(-1)↔local(+1); energy rest(-1)↔active(+1);
  density quiet(-1)↔crowded(+1); novelty classic(-1)↔unusual(+1);
  setting indoor/urban(-1)↔nature/outdoor(+1)
- micro_keywords: concrete tastes only (고양이, 독립서점); max 5; omit if none
- Infer from likes AND dislikes; keep numbers coarse (0.05 steps ok)
"""


def _strip_fence(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, float(v)))


def _normalize_pillars(p: dict) -> TourismPillars:
    keys = ("do_play", "see_learn", "stay_vibe", "eat_local")
    raw = {k: max(0.0, float(p.get(k, 0.25))) for k in keys}
    total = sum(raw.values()) or 1.0
    raw = {k: raw[k] / total for k in keys}
    # fix float drift
    drift = 1.0 - sum(raw.values())
    raw["stay_vibe"] = max(0.0, raw["stay_vibe"] + drift)
    return TourismPillars(**raw)


def _parse_dna(raw: str) -> TravelDNA:
    data = json.loads(_strip_fence(raw))
    if not isinstance(data, dict):
        raise ValueError("DNA JSON must be an object")
    pillars = _normalize_pillars(data.get("pillars") or {})
    ax = data.get("axes") or {}
    axes = PreferenceAxes(
        authenticity=_clamp(ax.get("authenticity", 0.0), -1.0, 1.0),
        energy=_clamp(ax.get("energy", 0.0), -1.0, 1.0),
        density=_clamp(ax.get("density", 0.0), -1.0, 1.0),
        novelty=_clamp(ax.get("novelty", 0.0), -1.0, 1.0),
        setting=_clamp(ax.get("setting", 0.0), -1.0, 1.0),
    )
    micros: list[str] = []
    for m in data.get("micro_keywords") or []:
        s = str(m).strip().lstrip("#")
        if s and s not in micros:
            micros.append(s)
        if len(micros) >= 5:
            break
    return TravelDNA(pillars=pillars, axes=axes, micro_keywords=micros)


def extract_travel_dna(
    text: str,
    *,
    llm: Optional[ChatModel] = None,
) -> TravelDNA:
    cleaned = (text or "").strip()
    if not cleaned:
        raise ValueError("text is required")
    model = llm or get_chat_model()
    resp = model.complete(
        [
            LlmMessage(role="system", content=_SYSTEM),
            LlmMessage(role="user", content=f"Travel likes/dislikes:\n{cleaned}"),
        ],
        temperature=0.2,
        response_json=True,
    )
    return _parse_dna(resp.text)

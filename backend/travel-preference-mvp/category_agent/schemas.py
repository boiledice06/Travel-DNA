"""Travel DNA (numeric) + name-only industry lists. No narratives."""
from __future__ import annotations

import math
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

PillarName = Literal["do_play", "see_learn", "stay_vibe", "eat_local"]

PILLAR_LABELS_KO: Dict[PillarName, str] = {
    "do_play": "탐험/액티비티",
    "see_learn": "감상/배움",
    "stay_vibe": "공간/무드",
    "eat_local": "미식/로컬",
}

DEFAULT_TOTAL_SLOTS = 16
MAX_TOTAL_SLOTS = 30


class PreferenceAxes(BaseModel):
    authenticity: float = Field(..., ge=-1.0, le=1.0)
    energy: float = Field(..., ge=-1.0, le=1.0)
    density: float = Field(..., ge=-1.0, le=1.0)
    novelty: float = Field(..., ge=-1.0, le=1.0)
    setting: float = Field(..., ge=-1.0, le=1.0)


class TourismPillars(BaseModel):
    do_play: float = Field(..., ge=0.0, le=1.0)
    see_learn: float = Field(..., ge=0.0, le=1.0)
    stay_vibe: float = Field(..., ge=0.0, le=1.0)
    eat_local: float = Field(..., ge=0.0, le=1.0)

    @model_validator(mode="after")
    def _sum_to_one(self) -> "TourismPillars":
        total = self.do_play + self.see_learn + self.stay_vibe + self.eat_local
        if abs(total - 1.0) > 1e-3:
            raise ValueError(f"pillars must sum to 1.0 (got {total})")
        return self

    def as_dict(self) -> Dict[PillarName, float]:
        return {
            "do_play": self.do_play,
            "see_learn": self.see_learn,
            "stay_vibe": self.stay_vibe,
            "eat_local": self.eat_local,
        }

    def allocate_slots(self, total_slots: int = DEFAULT_TOTAL_SLOTS) -> Dict[PillarName, int]:
        if total_slots <= 0:
            raise ValueError("total_slots must be > 0")
        ratios = self.as_dict()
        exact = {k: ratios[k] * total_slots for k in ratios}
        floors = {k: int(math.floor(exact[k])) for k in exact}
        remainders = sorted(
            ratios.keys(),
            key=lambda k: (exact[k] - floors[k], ratios[k]),
            reverse=True,
        )
        diff = total_slots - sum(floors.values())
        for i in range(diff):
            floors[remainders[i]] += 1
        return floors


class TravelDNA(BaseModel):
    pillars: TourismPillars
    axes: PreferenceAxes
    micro_keywords: List[str] = Field(default_factory=list)

    @field_validator("micro_keywords", mode="before")
    @classmethod
    def _strip_hashes(cls, v: object) -> object:
        if not isinstance(v, list):
            return v
        out = []
        for item in v:
            s = str(item).strip()
            if s.startswith("#"):
                s = s[1:]
            if s:
                out.append(s)
        return out


# Back-compat aliases used by search helpers / older callers
class IndustryKind(BaseModel):
    """Minimal wrapper — prefer plain industry name strings in plan response."""

    industry_ko: str
    slot_index: int = 0
    pillar: Optional[PillarName] = None


class MicroIndustryKind(BaseModel):
    industry_ko: str
    micro_keyword: str = ""


class IndustryPlanRequest(BaseModel):
    travel_dna: TravelDNA
    total_slots: int = Field(DEFAULT_TOTAL_SLOTS, ge=1, le=MAX_TOTAL_SLOTS)
    city: Optional[str] = None
    micro_kinds_per_keyword: int = Field(2, ge=1, le=5)


class IndustryPlanResponse(BaseModel):
    """Name-only recommendation lists (no summary/reason narrative)."""

    travel_dna: TravelDNA
    slot_allocation: Dict[PillarName, int]
    provider: str
    model: str
    industries: List[str] = Field(
        ...,
        description="Flat list of 업종명 only",
    )
    micro_industries: List[str] = Field(
        default_factory=list,
        description="Flat list of micro-driven 업종명 only",
    )
    city: Optional[str] = None
    region_agnostic: bool = True


class NlPipelineRequest(BaseModel):
    """Free-text taste → DNA → industries (+ optional Places)."""

    text: str = Field(..., min_length=1, description="Natural-language likes/dislikes")
    city: Optional[str] = Field(
        default=None,
        description="If set and run_places=true, run Places search",
    )
    total_slots: int = Field(DEFAULT_TOTAL_SLOTS, ge=1, le=MAX_TOTAL_SLOTS)
    micro_kinds_per_keyword: int = Field(2, ge=1, le=5)
    run_places: bool = Field(
        False,
        description="Only runs when city is provided and Places key is configured",
    )
    places_max_per_keyword: int = Field(3, ge=1, le=10)


class NlPipelineResponse(BaseModel):
    text: str
    travel_dna: TravelDNA
    industries: List[str]
    micro_industries: List[str] = Field(default_factory=list)
    slot_allocation: Dict[PillarName, int]
    provider: str
    model: str
    city: Optional[str] = None
    places: Optional[Any] = None  # PlacesSearchResponse dump when present

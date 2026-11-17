"""Join TripProfile + confirmed TravelDNA → industries → Seoul place shortlist."""
from __future__ import annotations

from typing import Any, List, Optional

from pydantic import BaseModel, Field

from .recommend import plan_industries_from_dna
from .schemas import DEFAULT_TOTAL_SLOTS, IndustryPlanResponse, TravelDNA
from .search.places_client import places_configured
from .search.seoul_find import (
    DEFAULT_SHORTLIST,
    SeoulFindResult,
    SeoulPlaceHit,
    find_seoul_places,
)
from .search.tourapi import tourapi_configured, visitseoul_status
from .store import get_profile, load_session_dict
from .trip_profile import TripProfile


class SeoulRunRequest(BaseModel):
    profile_id: str
    dna_session_id: str
    total_slots: int = Field(12, ge=1, le=30)
    run_places: bool = True  # Seoul find defaults ON
    places_max_per_keyword: int = Field(3, ge=1, le=10)
    micro_kinds_per_keyword: int = Field(2, ge=1, le=5)
    shortlist_size: int = Field(DEFAULT_SHORTLIST, ge=4, le=20)
    use_tourapi: bool = True


class SeoulRunResponse(BaseModel):
    profile: TripProfile
    travel_dna: TravelDNA
    constraints: dict
    industries: list[str]
    micro_industries: list[str]
    slot_allocation: dict
    provider: str
    model: str
    city: str = "서울"
    places: Optional[Any] = None  # legacy dump; prefer shortlist
    shortlist: List[SeoulPlaceHit] = Field(default_factory=list)
    find: Optional[SeoulFindResult] = None
    filters_applied: List[str] = Field(default_factory=list)


def _confirmed_session(session_id: str) -> dict:
    raw = load_session_dict(session_id)
    if raw is None:
        raise KeyError(f"dna session not found: {session_id}")
    if raw.get("phase") != "confirmed" or not raw.get("confirmed_dna"):
        raise ValueError("DNA chat not confirmed yet — finalize first")
    return raw


def _confirmed_dna(session_id: str) -> TravelDNA:
    raw = _confirmed_session(session_id)
    return TravelDNA.model_validate(raw["confirmed_dna"])


def run_seoul_pipeline(
    req: SeoulRunRequest,
    *,
    llm=None,
    places_client=None,
    tour_client=None,
) -> SeoulRunResponse:
    profile = get_profile(req.profile_id)
    if profile is None:
        raise KeyError(f"profile not found: {req.profile_id}")
    session = _confirmed_session(req.dna_session_id)
    dna = TravelDNA.model_validate(session["confirmed_dna"])
    must_have = session.get("must_have") or None
    must_avoid = session.get("must_avoid") or None
    if isinstance(must_have, str):
        must_have = must_have.strip() or None
    if isinstance(must_avoid, str):
        must_avoid = must_avoid.strip() or None

    constraints = profile.hard_constraints_summary()
    constraints["must_have"] = must_have
    constraints["must_avoid"] = must_avoid

    plan: IndustryPlanResponse = plan_industries_from_dna(
        travel_dna=dna,
        total_slots=req.total_slots,
        city=profile.city,
        micro_kinds_per_keyword=req.micro_kinds_per_keyword,
        llm=llm,
    )

    find: Optional[SeoulFindResult] = None
    shortlist: list[SeoulPlaceHit] = []
    filters: list[str] = []
    places_dump = None

    if req.run_places:
        if places_client is None and not places_configured():
            raise RuntimeError(
                "Seoul place finding needs GOOGLE_PLACES_API_KEY "
                "(TourAPI optional via TOUR_API_KEY)"
            )
        find = find_seoul_places(
            profile=profile,
            industries=list(plan.industries),
            micro_industries=list(plan.micro_industries),
            max_per_keyword=req.places_max_per_keyword,
            shortlist_size=req.shortlist_size,
            places_client=places_client,
            tour_client=tour_client,
            use_tourapi=req.use_tourapi,
            must_avoid=must_avoid,
            must_have=must_have,
        )
        shortlist = list(find.shortlist)
        filters = list(find.filters_applied)
        places_dump = {
            "shortlist": [h.model_dump() for h in shortlist],
            "raw_hit_count": find.raw_hit_count,
            "excluded_count": find.excluded_count,
            "sources_used": find.sources_used,
            "tourapi_configured": find.tourapi_configured,
            "visitseoul": find.visitseoul,
            "must_avoid": must_avoid,
            "must_have": must_have,
        }

    return SeoulRunResponse(
        profile=profile,
        travel_dna=dna,
        constraints=constraints,
        industries=plan.industries,
        micro_industries=plan.micro_industries,
        slot_allocation=plan.slot_allocation,
        provider=plan.provider,
        model=plan.model,
        city=profile.city,
        places=places_dump,
        shortlist=shortlist,
        find=find,
        filters_applied=filters,
    )


def discovery_health() -> dict:
    return {
        "places_configured": places_configured(),
        "tourapi_configured": tourapi_configured(),
        "visitseoul": visitseoul_status(),
        "city": "서울",
    }

"""NL → Travel DNA → name-only industries (+ optional Places if city set)."""
from __future__ import annotations

from typing import Optional

from .dna import extract_travel_dna
from .llm import ChatModel
from .recommend import plan_industries_from_dna
from .schemas import (
    DEFAULT_TOTAL_SLOTS,
    NlPipelineRequest,
    NlPipelineResponse,
    TravelDNA,
)
from .search.places_client import places_configured
from .search.schemas import PlacesSearchRequest, PlacesSearchResponse
from .search.service import search_places


def run_nl_pipeline(
    req: NlPipelineRequest,
    *,
    llm: Optional[ChatModel] = None,
) -> NlPipelineResponse:
    dna: TravelDNA = extract_travel_dna(req.text, llm=llm)
    plan = plan_industries_from_dna(
        travel_dna=dna,
        total_slots=req.total_slots,
        city=req.city,
        micro_kinds_per_keyword=req.micro_kinds_per_keyword,
        llm=llm,
    )

    places: Optional[PlacesSearchResponse] = None
    if req.city and req.run_places:
        if not places_configured():
            raise RuntimeError(
                "city provided with run_places=true but GOOGLE_PLACES_API_KEY is not set"
            )
        places = search_places(
            PlacesSearchRequest(
                city=req.city,
                industries=list(plan.industries),
                micro_industries=list(plan.micro_industries),
                max_results_per_keyword=req.places_max_per_keyword,
            )
        )

    return NlPipelineResponse(
        text=req.text,
        travel_dna=dna,
        industries=plan.industries,
        micro_industries=plan.micro_industries,
        slot_allocation=plan.slot_allocation,
        provider=plan.provider,
        model=plan.model,
        city=req.city,
        places=places.model_dump() if places is not None else None,
    )


def run_nl_to_industries(
    *,
    text: str,
    city: Optional[str] = None,
    total_slots: int = DEFAULT_TOTAL_SLOTS,
    run_places: bool = False,
    places_max_per_keyword: int = 3,
    micro_kinds_per_keyword: int = 2,
    llm: Optional[ChatModel] = None,
) -> NlPipelineResponse:
    return run_nl_pipeline(
        NlPipelineRequest(
            text=text,
            city=city,
            total_slots=total_slots,
            run_places=run_places,
            places_max_per_keyword=places_max_per_keyword,
            micro_kinds_per_keyword=micro_kinds_per_keyword,
        ),
        llm=llm,
    )

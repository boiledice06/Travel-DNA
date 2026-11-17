"""Orchestrate city + industry keywords → Places candidates per keyword."""
from __future__ import annotations

from typing import Optional

from category_agent.schemas import IndustryKind, IndustryPlanResponse, MicroIndustryKind

from .places_client import (
    PlacesClient,
    get_places_client,
    places_configured,
    seoul_location_circle,
)
from .schemas import (
    KeywordSearchResult,
    PlacesSearchRequest,
    PlacesSearchResponse,
)


def keywords_from_plan(plan: IndustryPlanResponse) -> list[str]:
    """Pull search keywords from name-only industry-plan lists."""
    req = PlacesSearchRequest(
        city=plan.city or "city",
        industries=list(plan.industries),
        micro_industries=list(plan.micro_industries),
    )
    return req.resolved_keywords()


def search_places(
    req: PlacesSearchRequest,
    *,
    client: Optional[PlacesClient] = None,
) -> PlacesSearchResponse:
    keywords = req.resolved_keywords()
    if not keywords:
        raise ValueError(
            "Provide keywords and/or industries / micro_industries with industry_ko"
        )

    live = client or get_places_client()
    is_seoul = req.city.strip() in {"서울", "Seoul", "seoul"}
    circle = seoul_location_circle() if is_seoul else None

    results: list[KeywordSearchResult] = []
    for kw in keywords:
        query = f"{req.city} {kw}".strip()
        try:
            cands = live.text_search(
                query,
                language=req.language,
                max_results=req.max_results_per_keyword,
                source_keyword=kw,
                region_code="KR" if is_seoul else "KR",
                location_circle=circle,
                strict_location=is_seoul,
            )
            results.append(
                KeywordSearchResult(
                    keyword=kw,
                    query=query,
                    candidates=cands,
                    status="OK" if cands else "ZERO_RESULTS",
                )
            )
        except Exception as exc:  # per-keyword isolation
            results.append(
                KeywordSearchResult(
                    keyword=kw,
                    query=query,
                    candidates=[],
                    status="ERROR",
                    error=str(exc),
                )
            )

    return PlacesSearchResponse(
        city=req.city,
        keywords=keywords,
        provider="google_places",
        results=results,
        configured=places_configured() if client is None else True,
    )


def search_from_plan(
    *,
    city: str,
    plan: IndustryPlanResponse,
    max_results_per_keyword: int = 5,
    client: Optional[PlacesClient] = None,
) -> PlacesSearchResponse:
    return search_places(
        PlacesSearchRequest(
            city=city,
            industries=list(plan.industries),
            micro_industries=list(plan.micro_industries),
            max_results_per_keyword=max_results_per_keyword,
        ),
        client=client,
    )


def search_from_kinds(
    *,
    city: str,
    industries: list[IndustryKind] | None = None,
    micro_industries: list[MicroIndustryKind] | None = None,
    keywords: list[str] | None = None,
    max_results_per_keyword: int = 5,
    client: Optional[PlacesClient] = None,
) -> PlacesSearchResponse:
    return search_places(
        PlacesSearchRequest(
            city=city,
            keywords=list(keywords or []),
            industries=list(industries or []),
            micro_industries=list(micro_industries or []),
            max_results_per_keyword=max_results_per_keyword,
        ),
        client=client,
    )

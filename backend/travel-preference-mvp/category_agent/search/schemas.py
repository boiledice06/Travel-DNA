"""Places search request/response — Stage 4 candidate collection."""
from __future__ import annotations

from typing import List, Optional, Union

from pydantic import BaseModel, Field

from category_agent.schemas import IndustryKind, MicroIndustryKind


class PlaceCandidate(BaseModel):
    name: str
    place_id: str = ""
    address: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    rating: Optional[float] = None
    user_ratings_total: Optional[int] = None
    maps_url: Optional[str] = None
    source_keyword: str = Field(..., description="Industry/micro kind that drove this query")
    price_level: Optional[str] = None
    source: str = "places"  # places | tourapi | visitseoul


class KeywordSearchResult(BaseModel):
    keyword: str
    query: str
    candidates: List[PlaceCandidate] = Field(default_factory=list)
    status: str = "OK"
    error: Optional[str] = None


def _as_name(item: Union[str, IndustryKind, MicroIndustryKind, dict]) -> str:
    if isinstance(item, str):
        return item.strip()
    if isinstance(item, (IndustryKind, MicroIndustryKind)):
        return (item.industry_ko or "").strip()
    if isinstance(item, dict):
        return str(item.get("industry_ko") or item.get("name") or "").strip()
    return ""


class PlacesSearchRequest(BaseModel):
    city: str = Field(..., min_length=1)
    keywords: List[str] = Field(default_factory=list)
    industries: List[Union[str, IndustryKind]] = Field(
        default_factory=list,
        description="Industry names from plan (strings) or legacy IndustryKind",
    )
    micro_industries: List[Union[str, MicroIndustryKind]] = Field(
        default_factory=list,
        description="Micro industry names (strings) or legacy objects",
    )
    max_results_per_keyword: int = Field(5, ge=1, le=20)
    language: str = "ko"

    def resolved_keywords(self) -> List[str]:
        seen: set[str] = set()
        out: list[str] = []
        for raw in list(self.keywords) + list(self.industries) + list(self.micro_industries):
            kw = _as_name(raw)
            if not kw or kw in seen:
                continue
            seen.add(kw)
            out.append(kw)
        return out


class PlacesSearchResponse(BaseModel):
    city: str
    keywords: List[str]
    provider: str = "google_places"
    results: List[KeywordSearchResult]
    configured: bool = True

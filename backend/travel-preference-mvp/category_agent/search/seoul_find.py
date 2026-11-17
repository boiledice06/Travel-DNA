"""Seoul place finding: Places (+ optional TourAPI) → merge → TripProfile filters → shortlist."""
from __future__ import annotations

import math
import re
from typing import List, Optional

from pydantic import BaseModel, Field

from category_agent.trip_profile import TripProfile

from .places_client import (
    PlacesClient,
    get_places_client,
    places_configured,
    seoul_location_circle,
)
from .schemas import PlaceCandidate
from .tourapi import TourApiClient, get_tourapi_client, tourapi_configured, visitseoul_status


SEOUL_CITY = "서울"
DEFAULT_SHORTLIST = 16
MAX_SHORTLIST = 20
MAX_KEYWORDS = 14


class SeoulPlaceHit(BaseModel):
    name: str
    address: str = ""
    rating: Optional[float] = None
    place_id: str = ""
    source_keyword: str = ""
    source: str = "places"
    maps_url: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    score: float = 0.0
    user_ratings_total: Optional[int] = None


class SeoulFindResult(BaseModel):
    city: str = SEOUL_CITY
    industries: List[str] = Field(default_factory=list)
    micro_industries: List[str] = Field(default_factory=list)
    keywords_searched: List[str] = Field(default_factory=list)
    shortlist: List[SeoulPlaceHit] = Field(default_factory=list)
    excluded_count: int = 0
    filters_applied: List[str] = Field(default_factory=list)
    sources_used: List[str] = Field(default_factory=list)
    places_configured: bool = False
    tourapi_configured: bool = False
    visitseoul: dict = Field(default_factory=dict)
    raw_hit_count: int = 0


def _tokens_free_text(text: Optional[str]) -> list[str]:
    if not text:
        return []
    parts = re.split(r"[,/\n;|]+|\s{2,}", text)
    out: list[str] = []
    for p in parts:
        t = p.strip().lower()
        if len(t) >= 2 and t not in ("없음", "없어요", "없습니다", "none"):
            out.append(t)
    if not out:
        out = [
            w.strip().lower()
            for w in text.split()
            if len(w.strip()) >= 2 and w.strip().lower() not in ("없음", "없어요")
        ]
    return out[:20]


def _tokens_must_avoid(text: Optional[str]) -> list[str]:
    return _tokens_free_text(text)


def _normalize_name(name: str) -> str:
    return re.sub(r"\s+", "", (name or "").lower())


def _geo_close(a: PlaceCandidate, b: PlaceCandidate, *, meters: float = 120.0) -> bool:
    if a.lat is None or a.lng is None or b.lat is None or b.lng is None:
        return False
    # rough meters
    dlat = (a.lat - b.lat) * 111_000
    dlng = (a.lng - b.lng) * 111_000 * math.cos(math.radians((a.lat + b.lat) / 2))
    return (dlat * dlat + dlng * dlng) ** 0.5 <= meters


def merge_candidates(rows: list[PlaceCandidate]) -> list[PlaceCandidate]:
    """Dedupe by place_id, else name+geo proximity."""
    kept: list[PlaceCandidate] = []
    seen_ids: set[str] = set()
    for row in rows:
        pid = (row.place_id or "").strip()
        if pid and not pid.startswith("tourapi:"):
            if pid in seen_ids:
                continue
            seen_ids.add(pid)
            kept.append(row)
            continue
        dup = False
        for k in kept:
            if _normalize_name(k.name) == _normalize_name(row.name) and (
                _geo_close(k, row) or (not row.lat and not k.lat)
            ):
                # prefer places source / higher rating
                if (row.rating or 0) > (k.rating or 0) and row.source == "places":
                    kept[kept.index(k)] = row
                dup = True
                break
        if not dup:
            if pid:
                seen_ids.add(pid)
            kept.append(row)
    return kept


def score_candidate(
    c: PlaceCandidate,
    profile: TripProfile,
    *,
    must_avoid: Optional[str] = None,
    must_have: Optional[str] = None,
) -> tuple[Optional[float], Optional[str]]:
    """Return (score, exclude_reason). score None means excluded.

    must_avoid / must_have come from the DNA session (not TripProfile).
    """
    blob = f"{c.name} {c.address} {c.source_keyword}".lower()
    for tok in _tokens_must_avoid(must_avoid):
        if tok in blob:
            return None, f"must_avoid:{tok}"

    rating = c.rating if c.rating is not None else 3.6
    reviews = c.user_ratings_total or 0
    score = rating + min(math.log10(reviews + 1), 2.0) * 0.35

    # Soft boost when must_have tokens appear (easy signal only)
    for tok in _tokens_free_text(must_have):
        if tok in blob:
            score += 0.55
            break

    # Soft budget signals (priceLevel when present)
    pl = (c.price_level or "").upper()
    if profile.budget_level == "low" and pl in {"PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE", "EXPENSIVE", "VERY_EXPENSIVE"}:
        score -= 0.8
    if profile.budget_level == "high" and pl in {"PRICE_LEVEL_FREE", "PRICE_LEVEL_INEXPENSIVE", "FREE", "INEXPENSIVE"}:
        score -= 0.15
    if profile.budget_level == "high" and c.rating:
        score += 0.08 * c.rating

    # Party / kids: soft downrank nightlife words
    if profile.companion_type == "with_kids":
        for bad in ("클럽", "바 ", "술집", "나이트", "호프"):
            if bad.strip() in blob:
                score -= 1.2

    # Lodging area hint
    if profile.lodging_area:
        area = profile.lodging_area.strip().lower()
        if area and area in blob:
            score += 0.6

    # Mobility: prefer fewer mega-tourist spots when one_neighborhood
    if profile.mobility_preference == "one_neighborhood" and reviews > 8000:
        score -= 0.25

    # Prefer Places hits slightly for long-tail micros
    if c.source == "places":
        score += 0.05
    elif c.source == "tourapi":
        score += 0.02

    return score, None


def filter_and_shortlist(
    candidates: list[PlaceCandidate],
    profile: TripProfile,
    *,
    shortlist_size: int = DEFAULT_SHORTLIST,
    must_avoid: Optional[str] = None,
    must_have: Optional[str] = None,
) -> tuple[list[SeoulPlaceHit], int, list[str]]:
    filters: list[str] = ["city=서울"]
    if must_avoid:
        filters.append("must_avoid_free_text_exclude")
    if must_have:
        filters.append("must_have_soft_boost")
    filters.append(f"budget_soft={profile.budget_level}")
    filters.append(f"party={profile.party_size}/{profile.companion_type}")
    filters.append(f"mobility={profile.mobility_preference}")
    if profile.lodging_area:
        filters.append("lodging_area_boost")

    scored: list[SeoulPlaceHit] = []
    excluded = 0
    for c in candidates:
        sc, reason = score_candidate(
            c, profile, must_avoid=must_avoid, must_have=must_have
        )
        if sc is None:
            excluded += 1
            continue
        scored.append(
            SeoulPlaceHit(
                name=c.name,
                address=c.address,
                rating=c.rating,
                place_id=c.place_id,
                source_keyword=c.source_keyword,
                source=c.source,
                maps_url=c.maps_url,
                lat=c.lat,
                lng=c.lng,
                score=round(sc, 3),
                user_ratings_total=c.user_ratings_total,
            )
        )
    scored.sort(key=lambda x: x.score, reverse=True)
    n = max(1, min(int(shortlist_size), MAX_SHORTLIST))
    return scored[:n], excluded, filters


def find_seoul_places(
    *,
    profile: TripProfile,
    industries: list[str],
    micro_industries: list[str],
    max_per_keyword: int = 3,
    shortlist_size: int = DEFAULT_SHORTLIST,
    places_client: Optional[PlacesClient] = None,
    tour_client: Optional[TourApiClient] = None,
    use_tourapi: bool = True,
    must_avoid: Optional[str] = None,
    must_have: Optional[str] = None,
) -> SeoulFindResult:
    """Search Seoul only — never invent places. TourAPI skipped if no key/client."""
    keywords: list[str] = []
    seen: set[str] = set()
    for kw in list(industries) + list(micro_industries):
        s = (kw or "").strip()
        if not s or s in seen:
            continue
        seen.add(s)
        keywords.append(s)
        if len(keywords) >= MAX_KEYWORDS:
            break

    sources_used: list[str] = []
    raw: list[PlaceCandidate] = []
    attempted = 0
    succeeded = 0

    places_ok = places_configured() if places_client is None else True
    if places_client is None and places_ok:
        places_client = get_places_client()

    circle = seoul_location_circle()
    if places_client is not None:
        sources_used.append("places")
        for kw in keywords:
            attempted += 1
            query = f"{SEOUL_CITY} {kw}"
            try:
                raw.extend(
                    places_client.text_search(
                        query,
                        language="ko",
                        max_results=max_per_keyword,
                        source_keyword=kw,
                        region_code="KR",
                        location_circle=circle,
                        strict_location=True,
                    )
                )
                succeeded += 1
            except Exception:
                # try bias-only fallback once style: re-raise isolation per keyword
                try:
                    raw.extend(
                        places_client.text_search(
                            query,
                            language="ko",
                            max_results=max_per_keyword,
                            source_keyword=kw,
                            region_code="KR",
                            location_circle=circle,
                            strict_location=False,
                        )
                    )
                    succeeded += 1
                except Exception:
                    continue

    tour: Optional[TourApiClient] = tour_client
    if use_tourapi and tour is None:
        tour = get_tourapi_client()
    tour_ok = tour is not None
    if tour is not None:
        sources_used.append("tourapi")
        for kw in keywords[:8]:  # keep TourAPI lighter
            attempted += 1
            try:
                raw.extend(
                    tour.keyword_search(kw, max_results=max(1, max_per_keyword - 1), source_keyword=kw)
                )
                succeeded += 1
            except Exception:
                continue

    if attempted and not succeeded:
        # Do not expose provider exception bodies: they may contain keys or request data.
        raise RuntimeError("장소 검색 서비스에 연결하지 못했습니다. 서버 설정을 확인해 주세요.")

    merged = merge_candidates(raw)
    shortlist, excluded, filters = filter_and_shortlist(
        merged,
        profile,
        shortlist_size=shortlist_size,
        must_avoid=must_avoid,
        must_have=must_have,
    )

    return SeoulFindResult(
        city=SEOUL_CITY,
        industries=list(industries),
        micro_industries=list(micro_industries),
        keywords_searched=keywords,
        shortlist=shortlist,
        excluded_count=excluded,
        filters_applied=filters,
        sources_used=sources_used,
        places_configured=places_ok,
        tourapi_configured=tour_ok or tourapi_configured(),
        visitseoul=visitseoul_status(),
        raw_hit_count=len(raw),
    )

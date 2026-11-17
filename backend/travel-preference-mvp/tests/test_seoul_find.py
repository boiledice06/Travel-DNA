"""Seoul place finding — fake Places (+ optional TourAPI), no live keys."""
from __future__ import annotations

from category_agent.search.schemas import PlaceCandidate
from category_agent.search.seoul_find import (
    find_seoul_places,
    filter_and_shortlist,
    merge_candidates,
)
from category_agent.trip_profile import TripProfileCreate


class FakePlacesClient:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def text_search(
        self,
        query: str,
        *,
        language: str = "ko",
        max_results: int = 5,
        source_keyword: str = "",
        region_code: str = "KR",
        location_circle=None,
        strict_location: bool = False,
    ) -> list[PlaceCandidate]:
        self.calls.append(
            {
                "query": query,
                "region_code": region_code,
                "location_circle": location_circle,
                "strict_location": strict_location,
            }
        )
        base = [
            PlaceCandidate(
                name=f"서울 {source_keyword} 맛집",
                place_id=f"places/{source_keyword}-a",
                address="서울특별시 중구 세종대로 110",
                lat=37.5665,
                lng=126.9780,
                rating=4.4,
                user_ratings_total=200,
                source_keyword=source_keyword,
                source="places",
            ),
            PlaceCandidate(
                name="클럽 나이트서울",
                place_id=f"places/{source_keyword}-club",
                address="서울특별시 강남구",
                lat=37.50,
                lng=127.02,
                rating=4.0,
                user_ratings_total=50,
                source_keyword=source_keyword,
                source="places",
            ),
        ]
        return base[:max_results]


class FakeTourClient:
    def keyword_search(
        self,
        keyword: str,
        *,
        max_results: int = 5,
        source_keyword: str = "",
    ) -> list[PlaceCandidate]:
        return [
            PlaceCandidate(
                name=f"관광_{keyword}",
                place_id=f"tourapi:{keyword}",
                address="서울특별시 종로구",
                lat=37.57,
                lng=126.98,
                source_keyword=source_keyword or keyword,
                source="tourapi",
            )
        ]


def _profile(**kw):
    data = {
        "party_size": "2",
        "companion_type": "couple",
        "duration": "full_day",
        "transport": "walk_subway",
        "time_window": "afternoon",
    }
    data.update(kw)
    return TripProfileCreate(**data).to_profile()


def test_seoul_find_scopes_places_and_filters_must_avoid():
    fake = FakePlacesClient()
    profile = _profile()
    result = find_seoul_places(
        profile=profile,
        industries=["카페", "갤러리"],
        micro_industries=["독립서점"],
        max_per_keyword=2,
        shortlist_size=12,
        places_client=fake,
        tour_client=None,
        use_tourapi=False,
        must_avoid="클럽",
        must_have="맛집",
    )
    assert result.city == "서울"
    assert all(c["query"].startswith("서울 ") for c in fake.calls)
    assert all(c["strict_location"] for c in fake.calls)
    assert all(c["location_circle"] is not None for c in fake.calls)
    assert "must_avoid_free_text_exclude" in result.filters_applied
    assert "must_have_soft_boost" in result.filters_applied
    names = [h.name for h in result.shortlist]
    assert all("클럽" not in n for n in names)
    assert result.excluded_count >= 1
    assert result.shortlist
    hit = result.shortlist[0]
    assert hit.place_id
    assert hit.source_keyword
    assert hit.address


def test_merge_dedupes_same_place_id():
    a = PlaceCandidate(name="A", place_id="x", source_keyword="카페", rating=4.0)
    b = PlaceCandidate(name="A2", place_id="x", source_keyword="카페", rating=4.5)
    merged = merge_candidates([a, b])
    assert len(merged) == 1


def test_tourapi_merged_when_provided():
    result = find_seoul_places(
        profile=_profile(),
        industries=["박물관"],
        micro_industries=[],
        places_client=FakePlacesClient(),
        tour_client=FakeTourClient(),
        use_tourapi=True,
        shortlist_size=10,
    )
    assert "places" in result.sources_used
    assert "tourapi" in result.sources_used
    sources = {h.source for h in result.shortlist}
    assert "places" in sources
    # tour may or may not survive ranking — at least raw used tour
    assert result.raw_hit_count >= 2


def test_filter_shortlist_cap():
    profile = _profile()
    cands = [
        PlaceCandidate(
            name=f"장소{i}",
            place_id=f"p{i}",
            address="서울",
            rating=4.0 + (i % 5) * 0.1,
            user_ratings_total=10 * i,
            source_keyword="카페",
            source="places",
        )
        for i in range(30)
    ]
    short, excluded, filters = filter_and_shortlist(cands, profile, shortlist_size=16)
    assert len(short) == 16
    assert excluded == 0
    assert "city=서울" in filters


def test_failed_provider_is_not_reported_as_successful_empty_result():
    class FailingPlaces:
        def text_search(self, *args, **kwargs):
            raise RuntimeError('provider error containing a hypothetical secret')

    import pytest
    with pytest.raises(RuntimeError, match='장소 검색 서비스') as exc:
        find_seoul_places(profile=_profile(), industries=['카페'], micro_industries=[], places_client=FailingPlaces(), use_tourapi=False)
    assert 'hypothetical secret' not in str(exc.value)


def test_successful_empty_provider_remains_a_valid_empty_result():
    class EmptyPlaces:
        def text_search(self, *args, **kwargs):
            return []

    result = find_seoul_places(profile=_profile(), industries=['카페'], micro_industries=[], places_client=EmptyPlaces(), use_tourapi=False)
    assert result.shortlist == []

"""Places search unit tests — mocked client, no live API."""
from __future__ import annotations

import pytest

from category_agent.search.schemas import PlaceCandidate, PlacesSearchRequest
from category_agent.search.service import search_places


class FakePlacesClient:
    def __init__(self) -> None:
        self.queries: list[str] = []
        self.kwargs: list[dict] = []

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
        self.queries.append(query)
        self.kwargs.append(
            {
                "region_code": region_code,
                "location_circle": location_circle,
                "strict_location": strict_location,
            }
        )
        return [
            PlaceCandidate(
                name=f"Fake {source_keyword}",
                place_id=f"pid_{source_keyword}",
                address="Somewhere",
                lat=35.0,
                lng=135.0,
                rating=4.5,
                user_ratings_total=100,
                maps_url=None,
                source_keyword=source_keyword,
            )
        ]


def test_resolved_keywords_from_name_lists():
    req = PlacesSearchRequest(
        city="안산",
        keywords=["카페"],
        industries=["갤러리"],
        micro_industries=["고양이 카페"],
    )
    assert req.resolved_keywords() == ["카페", "갤러리", "고양이 카페"]


def test_search_places_with_fake_client():
    fake = FakePlacesClient()
    out = search_places(
        PlacesSearchRequest(city="안산", keywords=["갤러리", "방탈출"], max_results_per_keyword=3),
        client=fake,
    )
    assert out.results[0].query == "안산 갤러리"
    assert fake.queries == ["안산 갤러리", "안산 방탈출"]


def test_seoul_search_requests_strict_address_check():
    fake = FakePlacesClient()
    search_places(
        PlacesSearchRequest(city="서울", keywords=["카페"], max_results_per_keyword=2),
        client=fake,
    )
    assert fake.kwargs[0]["strict_location"] is True
    assert fake.kwargs[0]["location_circle"] is not None
    assert fake.queries == ["서울 카페"]


def test_search_requires_keywords():
    with pytest.raises(ValueError):
        search_places(PlacesSearchRequest(city="안산"), client=FakePlacesClient())

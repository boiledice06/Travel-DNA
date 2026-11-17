"""Text Search wire contract and failure handling without network access."""
import io
import json
import urllib.error

import pytest

from category_agent.search.places_client import FIELD_MASK, GooglePlacesClient, _has_seoul_address
from category_agent.search.schemas import PlacesSearchRequest


class Response:
    def __init__(self, data):
        self.data = json.dumps(data, ensure_ascii=False).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return self.data


def test_text_search_request_and_response(monkeypatch):
    calls = []

    def urlopen(request, timeout):
        calls.append((request, timeout))
        return Response({"places": [
            {"id": "p1", "displayName": {"text": "궁"},
             "formattedAddress": "대한민국 서울특별시 종로구", "location": {"latitude": 37.5, "longitude": 127.0},
             "rating": 4.5, "userRatingCount": 42, "googleMapsUri": "https://maps.google.com/", "priceLevel": "PRICE_LEVEL_FREE"},
            {"id": "p2", "displayName": {"text": "Outside"}, "formattedAddress": "경기도 고양시"},
            {"id": "p3", "displayName": {"text": "Unknown"}},
            {"id": "p4", "displayName": {"text": "Museum"}, "formattedAddress": "123 Main St, Seoul, South Korea"},
        ]})

    monkeypatch.setattr("urllib.request.urlopen", urlopen)
    result = GooglePlacesClient("test-key").text_search(
        "서울 관광지", max_results=5, source_keyword="관광지",
        location_circle=(37.5665, 126.978, 22000), strict_location=True,
    )
    request, timeout = calls[0]
    assert len(calls) == 1 and timeout == 25.0
    assert request.full_url == "https://places.googleapis.com/v1/places:searchText"
    assert request.get_method() == "POST"
    assert request.get_header("X-goog-api-key") == "test-key"
    assert request.get_header("X-goog-fieldmask") == FIELD_MASK
    assert set(FIELD_MASK.split(",")) == {"places.id", "places.displayName", "places.formattedAddress", "places.location", "places.rating", "places.userRatingCount", "places.googleMapsUri", "places.priceLevel"}
    assert json.loads(request.data) == {
        "textQuery": "서울 관광지", "languageCode": "ko", "pageSize": 5, "regionCode": "KR",
        "locationBias": {"circle": {"center": {"latitude": 37.5665, "longitude": 126.978}, "radius": 22000.0}},
    }
    assert [p.name for p in result] == ["궁", "Museum"]
    place = result[0]
    assert (place.place_id, place.lat, place.lng, place.rating, place.user_ratings_total, place.price_level) == ("p1", 37.5, 127.0, 4.5, 42, "PRICE_LEVEL_FREE")
    assert place.maps_url == "https://maps.google.com/" and place.source_keyword == "관광지"
    assert result[1].maps_url.endswith("place_id:p4")


@pytest.mark.parametrize("address,expected", [
    ("서울특별시 중구", True), ("서울 중구", True), ("Seoul, South Korea", True),
    ("123 Street, Seoul 03045, South Korea", True), ("경기도 서울로 1", False),
    ("Seoul Station, Goyang, South Korea", False), ("", False),
])
def test_seoul_address_is_conservative(address, expected):
    assert _has_seoul_address(address) is expected


def test_http_error_is_redacted_and_endpoint_reports_error(monkeypatch):
    from app import main
    from category_agent.search.service import search_places

    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "test-key")
    def fail(request, timeout):
        raise urllib.error.HTTPError(request.full_url, 403, "Forbidden", {}, io.BytesIO(b'{"message":"test-key denied"}'))
    monkeypatch.setattr("urllib.request.urlopen", fail)
    monkeypatch.setattr(main, "places_configured", lambda: True)
    monkeypatch.setattr(main, "search_places", lambda req: search_places(req, client=GooglePlacesClient("test-key")))
    response = main.api_places_search(PlacesSearchRequest(city="서울", keywords=["관광지"]))
    result = json.loads(response.body)["results"][0]
    assert response.status_code == 200
    assert result["status"] == "ERROR" and not result["candidates"]
    assert "Places HTTP 403" in result["error"]
    assert "test-key" not in result["error"] and "[REDACTED]" in result["error"]


def test_network_error_is_redacted(monkeypatch):
    def fail(request, timeout):
        raise urllib.error.URLError("test-key unavailable")
    monkeypatch.setattr("urllib.request.urlopen", fail)
    with pytest.raises(RuntimeError) as exc:
        GooglePlacesClient("test-key").text_search("서울")
    assert "test-key" not in str(exc.value) and "[REDACTED]" in str(exc.value)

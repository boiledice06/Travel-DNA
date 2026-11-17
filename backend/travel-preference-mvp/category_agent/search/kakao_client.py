"""Kakao Local keyword search with conservative Seoul address validation."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request

from .places_client import _has_seoul_address, seoul_location_circle
from .schemas import PlaceCandidate

SEARCH_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"


def places_api_key() -> str:
    return os.getenv("KAKAO_REST_API_KEY", "").strip()


def places_configured() -> bool:
    return bool(places_api_key())


class KakaoPlacesClient:
    def __init__(self, api_key: str | None = None, *, timeout: float = 25.0):
        self.api_key = (api_key if api_key is not None else places_api_key()).strip()
        self.timeout = timeout
        if not self.api_key:
            raise RuntimeError("KAKAO_REST_API_KEY is not set")

    def text_search(self, query: str, *, language: str = "ko", max_results: int = 5,
                    source_keyword: str = "", region_code: str = "KR",
                    location_circle=None, strict_location: bool = False) -> list[PlaceCandidate]:
        del language, region_code, location_circle
        # No radius: Kakao's 20 km maximum would exclude parts of Seoul.
        params = urllib.parse.urlencode({"query": query, "size": max(1, min(int(max_results), 15))})
        request = urllib.request.Request(f"{SEARCH_URL}?{params}", headers={"Authorization": f"KakaoAK {self.api_key}"})
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                data = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            # Provider bodies can echo credentials; expose only status.
            raise RuntimeError(f"Kakao HTTP {exc.code}") from None
        except urllib.error.URLError:
            raise RuntimeError("Kakao network error") from None

        result = []
        for row in data.get("documents", []):
            address = str(row.get("road_address_name") or row.get("address_name") or "")
            if strict_location and not _has_seoul_address(address):
                continue
            try:
                lat = float(row["y"])
                lng = float(row["x"])
            except (KeyError, TypeError, ValueError):
                continue
            name = str(row.get("place_name") or "").strip()
            place_id = str(row.get("id") or "").strip()
            if not name or not place_id:
                continue
            result.append(PlaceCandidate(
                name=name, place_id=place_id, address=address, lat=lat, lng=lng,
                source_keyword=source_keyword or query, source="kakao",
                maps_url=row.get("place_url") or None, category=row.get("category_name") or None,
            ))
        return result


def get_places_client() -> KakaoPlacesClient:
    return KakaoPlacesClient()

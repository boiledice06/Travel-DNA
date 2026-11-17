"""Google Places Text Search (New) client — env key; no invented secrets."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any, Optional, Protocol, Tuple

from .schemas import PlaceCandidate

# Places API (New) — legacy maps.googleapis.com/place/textsearch is often disabled
SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText"
FIELD_MASK = ",".join(
    [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.rating",
        "places.userRatingCount",
        "places.googleMapsUri",
        "places.priceLevel",
    ]
)

# Seoul City Hall — bias/restriction center
SEOUL_CENTER_LAT = 37.5665
SEOUL_CENTER_LNG = 126.9780
SEOUL_RADIUS_M = 22000.0


def places_api_key() -> str:
    return (
        os.getenv("GOOGLE_PLACES_API_KEY", "").strip()
        or os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
    )


def places_configured() -> bool:
    return bool(places_api_key())


class PlacesClient(Protocol):
    def text_search(
        self,
        query: str,
        *,
        language: str = "ko",
        max_results: int = 5,
        source_keyword: str = "",
        region_code: str = "KR",
        location_circle: Optional[Tuple[float, float, float]] = None,
        strict_location: bool = False,
    ) -> list[PlaceCandidate]: ...


class GooglePlacesClient:
    """Live Text Search (New) against Places API."""

    def __init__(self, api_key: Optional[str] = None, *, timeout: float = 25.0) -> None:
        self.api_key = (api_key if api_key is not None else places_api_key()).strip()
        self.timeout = timeout
        if not self.api_key:
            raise RuntimeError(
                "GOOGLE_PLACES_API_KEY (or GOOGLE_MAPS_API_KEY) is not set. "
                "Add it to .env — do not invent a key."
            )

    def text_search(
        self,
        query: str,
        *,
        language: str = "ko",
        max_results: int = 5,
        source_keyword: str = "",
        region_code: str = "KR",
        location_circle: Optional[Tuple[float, float, float]] = None,
        strict_location: bool = False,
    ) -> list[PlaceCandidate]:
        payload: dict[str, Any] = {
            "textQuery": query,
            "languageCode": language or "ko",
            "pageSize": max(1, min(int(max_results), 20)),
        }
        if region_code:
            payload["regionCode"] = region_code
        if location_circle is not None:
            lat, lng, radius = location_circle
            circle = {
                "circle": {
                    "center": {"latitude": float(lat), "longitude": float(lng)},
                    "radius": float(radius),
                }
            }
            if strict_location:
                payload["locationRestriction"] = circle
            else:
                payload["locationBias"] = circle

        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            SEARCH_TEXT_URL,
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": self.api_key,
                "X-Goog-FieldMask": FIELD_MASK,
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data: dict[str, Any] = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            safe = raw.replace(self.api_key, "[REDACTED]")
            raise RuntimeError(f"Places HTTP {exc.code}: {safe}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Places network error: {exc}") from exc

        places = data.get("places") or []
        out: list[PlaceCandidate] = []
        for row in places[:max_results]:
            loc = row.get("location") or {}
            display = row.get("displayName") or {}
            name = str(display.get("text") or row.get("name") or "unknown")
            pid = str(row.get("id") or "")
            maps = row.get("googleMapsUri")
            if not maps and pid:
                maps = f"https://www.google.com/maps/place/?q=place_id:{pid}"
            rating = row.get("rating")
            urc = row.get("userRatingCount")
            price = row.get("priceLevel")
            out.append(
                PlaceCandidate(
                    name=name,
                    place_id=pid,
                    address=str(row.get("formattedAddress") or ""),
                    lat=loc.get("latitude"),
                    lng=loc.get("longitude"),
                    rating=float(rating) if rating is not None else None,
                    user_ratings_total=int(urc) if urc is not None else None,
                    maps_url=str(maps) if maps else None,
                    source_keyword=source_keyword or query,
                    price_level=str(price) if price is not None else None,
                    source="places",
                )
            )
        return out


def get_places_client() -> GooglePlacesClient:
    return GooglePlacesClient()


def seoul_location_circle() -> Tuple[float, float, float]:
    return (SEOUL_CENTER_LAT, SEOUL_CENTER_LNG, SEOUL_RADIUS_M)

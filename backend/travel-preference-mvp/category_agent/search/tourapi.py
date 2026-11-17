"""Korea TourAPI (KorService2) adapter — Seoul areaCode=1. Graceful skip if no key."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Optional, Protocol

from .schemas import PlaceCandidate

TOUR_BASE = "https://apis.data.go.kr/B551011/KorService2/searchKeyword2"
SEOUL_AREA_CODE = "1"


def tour_api_key() -> str:
    return (
        os.getenv("TOUR_API_KEY", "").strip()
        or os.getenv("DATA_GO_KR_SERVICE_KEY", "").strip()
    )


def tourapi_configured() -> bool:
    return bool(tour_api_key())


class TourApiClient(Protocol):
    def keyword_search(
        self,
        keyword: str,
        *,
        max_results: int = 5,
        source_keyword: str = "",
    ) -> list[PlaceCandidate]: ...


class KoreaTourApiClient:
    """Live TourAPI keyword search scoped to Seoul (areaCode=1)."""

    def __init__(self, api_key: Optional[str] = None, *, timeout: float = 25.0) -> None:
        self.api_key = (api_key if api_key is not None else tour_api_key()).strip()
        self.timeout = timeout
        if not self.api_key:
            raise RuntimeError(
                "TOUR_API_KEY (or DATA_GO_KR_SERVICE_KEY) is not set. "
                "Add it to .env — do not invent a key."
            )

    def keyword_search(
        self,
        keyword: str,
        *,
        max_results: int = 5,
        source_keyword: str = "",
    ) -> list[PlaceCandidate]:
        params = {
            "serviceKey": self.api_key,
            "MobileOS": "ETC",
            "MobileApp": "TravelPreferenceMVP",
            "_type": "json",
            "numOfRows": str(max(1, min(int(max_results), 20))),
            "pageNo": "1",
            "keyword": keyword,
            "areaCode": SEOUL_AREA_CODE,
            "arrange": "C",
        }
        url = f"{TOUR_BASE}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data: dict[str, Any] = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            safe = raw.replace(self.api_key, "[REDACTED]")
            raise RuntimeError(f"TourAPI HTTP {exc.code}: {safe}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"TourAPI network error: {exc}") from exc

        items = (
            ((data.get("response") or {}).get("body") or {}).get("items") or {}
        )
        rows = items.get("item") if isinstance(items, dict) else None
        if rows is None:
            return []
        if isinstance(rows, dict):
            rows = [rows]

        out: list[PlaceCandidate] = []
        for row in rows[:max_results]:
            name = str(row.get("title") or "").strip()
            if not name:
                continue
            addr = str(row.get("addr1") or "")
            if row.get("addr2"):
                addr = f"{addr} {row.get('addr2')}".strip()
            content_id = str(row.get("contentid") or "")
            try:
                lat = float(row["mapy"]) if row.get("mapy") else None
                lng = float(row["mapx"]) if row.get("mapx") else None
            except (TypeError, ValueError):
                lat, lng = None, None
            out.append(
                PlaceCandidate(
                    name=name,
                    place_id=f"tourapi:{content_id}" if content_id else "",
                    address=addr,
                    lat=lat,
                    lng=lng,
                    rating=None,
                    user_ratings_total=None,
                    maps_url=None,
                    source_keyword=source_keyword or keyword,
                    source="tourapi",
                )
            )
        return out


def get_tourapi_client() -> Optional[KoreaTourApiClient]:
    if not tourapi_configured():
        return None
    return KoreaTourApiClient()


# Visit Seoul — stub only for this slice
def visitseoul_configured() -> bool:
    return bool(os.getenv("VISITSEOUL_API_KEY", "").strip())


def visitseoul_status() -> dict:
    return {
        "configured": visitseoul_configured(),
        "env": "VISITSEOUL_API_KEY",
        "status": "stub_optional" if not visitseoul_configured() else "key_present_adapter_deferred",
    }

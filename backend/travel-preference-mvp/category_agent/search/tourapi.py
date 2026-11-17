"""Korea TourAPI (KorService2) adapter — Seoul areaCode=1. Graceful skip if no key."""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from typing import Any, Optional, Protocol

from .places_client import _has_seoul_address
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
            # Portal provides encoded and decoded forms; urlencode exactly once.
            "serviceKey": urllib.parse.unquote(self.api_key),
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
                raw = resp.read().decode("utf-8-sig")
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"TourAPI HTTP {exc.code}") from None
        except urllib.error.URLError:
            raise RuntimeError("TourAPI network error") from None

        try:
            data: dict[str, Any] = json.loads(raw)
        except json.JSONDecodeError:
            try:
                root = ET.fromstring(raw)
                code = root.findtext('.//returnReasonCode') or root.findtext('.//resultCode') or 'unknown'
            except ET.ParseError:
                code = 'invalid_response'
            code = code if re.fullmatch(r"[A-Za-z0-9_-]{1,32}", code) else "invalid_response"
            raise RuntimeError(f"TourAPI response error: {code}") from None
        header = (data.get("response") or {}).get("header") or {}
        code = str(header.get("resultCode") or "")
        if code not in {"0000", "00"}:
            safe_code = code if re.fullmatch(r"[A-Za-z0-9_-]{1,32}", code) else "invalid_response"
            raise RuntimeError(f"TourAPI response error: {safe_code}")

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
            if not content_id or not _has_seoul_address(addr) or lat is None or lng is None:
                continue
            if not (37.4 <= lat <= 37.75 and 126.75 <= lng <= 127.2):
                continue
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
                    image_url=_tour_image_url(row.get("firstimage")),
                    source_keyword=source_keyword or keyword,
                    source="tourapi",
                    category={"12": "관광지", "14": "문화시설", "15": "축제공연행사", "25": "여행코스", "28": "레포츠", "32": "숙박", "38": "쇼핑", "39": "음식점"}.get(str(row.get("contenttypeid") or "")),
                )
            )
        return out


def _tour_image_url(value: Any) -> Optional[str]:
    """Accept only official TourAPI image hosts; use HTTPS for web mixed-content safety."""
    if not isinstance(value, str):
        return None
    parsed = urllib.parse.urlsplit(value.strip())
    if parsed.scheme not in {"http", "https"} or parsed.hostname not in {"tong.visitkorea.or.kr", "cdn.visitkorea.or.kr"} or parsed.username or parsed.password or parsed.port:
        return None
    return urllib.parse.urlunsplit(("https", parsed.netloc, parsed.path, parsed.query, ""))


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

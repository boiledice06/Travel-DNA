"""Official photo sources and conservative place-identity checks."""
from __future__ import annotations

import json
import math
import os
import re
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from time import monotonic
from typing import Literal

from pydantic import BaseModel, Field

from .tourapi import _tour_image_url, tour_api_key

AGENT = "TravelDNA/1.0 (https://github.com/boiledice06/Travel-DNA)"
KTO = "https://apis.data.go.kr/B551011"
KOGL = "https://www.kogl.or.kr/info/license.do"
TOUR_DOCUMENT = "https://www.data.go.kr/data/15101578/openapi.do"
GALLERY_DOCUMENT = "https://www.data.go.kr/data/15101914/openapi.do"
WIKIDATA = "https://www.wikidata.org/w/api.php"
COMMONS = "https://commons.wikimedia.org/w/api.php"

Provider = Literal["tourapi", "gallery", "commons"]


class PhotoPlace(BaseModel, frozen=True):
    id: str = Field(min_length=1, max_length=350)
    name: str = Field(min_length=2, max_length=180)
    address: str = Field(default="", max_length=260)
    latitude: float = Field(ge=37.4, le=37.75)
    longitude: float = Field(ge=126.75, le=127.2)


class PlacePhoto(BaseModel, frozen=True):
    url: str
    source_page: str
    provider: Provider
    publisher: str
    author: str | None
    license: str
    license_url: str
    can_modify: bool
    match: tuple[str, ...]
    description: str = ""
    attribution: str = ""


class SourceFailure(RuntimeError):
    pass


def photo_health() -> dict[str, bool]:
    return {"tourapi": bool(tour_api_key()), "gallery": bool(os.getenv("TOUR_PHOTO_API_KEY", "").strip()), "commons": True}


def normalize(value: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFKC", value).casefold() if ch.isalnum())


def road_address(value: str) -> str:
    match = re.search(r"([가-힣0-9·]+(?:대로|로|길))\s+(\d+(?:-\d+)?)\b", value)
    district = re.search(r"[가-힣]+구(?=\s)", value)
    return f"{district[0]}/{match[1]}/{match[2]}" if district and match else ""


def distance(place: PhotoPlace, lat: float, lon: float) -> int:
    if not (math.isfinite(lat) and math.isfinite(lon)):
        return 10_000_000
    return round(math.hypot((place.latitude - lat) * 111_195,
                            (place.longitude - lon) * 111_195 * math.cos(math.radians(place.latitude))))


def request_json(base: str, params: dict, deadline: float) -> dict:
    remaining = deadline - monotonic()
    if remaining < 0.15:
        raise SourceFailure("deadline")
    url = base + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=min(2.5, remaining)) as response:
            raw = response.read(1_000_001)
        if len(raw) > 1_000_000:
            raise SourceFailure("response_too_large")
        data = json.loads(raw.decode("utf-8-sig"))
    except urllib.error.HTTPError as exc:
        raise SourceFailure(f"http_{exc.code}") from None
    except (OSError, UnicodeError, ValueError):
        raise SourceFailure("unavailable_or_invalid") from None
    if not isinstance(data, dict) or "error" in data:
        raise SourceFailure("provider_error")
    return data


def kto_rows(service: str, op: str, key: str, deadline: float, **params) -> list[dict]:
    data = request_json(f"{KTO}/{service}/{op}", {
        "serviceKey": urllib.parse.unquote(key), "MobileOS": "ETC", "MobileApp": "TravelDNA",
        "_type": "json", "numOfRows": 8, **params,
    }, deadline)
    response = data.get("response") or {}
    if str((response.get("header") or {}).get("resultCode")) not in {"0000", "00"}:
        raise SourceFailure("provider_error")
    items = (response.get("body") or {}).get("items")
    rows = items.get("item") if isinstance(items, dict) else []
    if isinstance(rows, dict):
        rows = [rows]
    return [row for row in (rows or []) if isinstance(row, dict)]


def tour_photo(place: PhotoPlace, deadline: float) -> PlacePhoto | None:
    rows = kto_rows("KorService2", "searchKeyword2", tour_api_key(), deadline,
                    keyword=place.name, areaCode="1")
    matches = []
    name = normalize(place.name)
    if not name:
        return None
    for row in rows:
        if normalize(str(row.get("title") or "")) != name:
            continue
        try:
            meters = distance(place, float(row["mapy"]), float(row["mapx"]))
        except (KeyError, TypeError, ValueError):
            continue
        addr = road_address(place.address)
        same_address = bool(addr and addr == road_address(str(row.get("addr1") or "")))
        # An address proves the building, while the coordinate check also rules out tangential records.
        if meters <= (180 if same_address else 100):
            matches.append((row, meters, same_address))
    if len({str(row.get("contentid")) for row, _, _ in matches}) != 1:
        return None
    row, meters, same_address = matches[0]
    copyright_code = row.get("cpyrhtDivCd")
    url = _tour_image_url(row.get("firstimage"))
    if (not url or urllib.parse.urlsplit(url).query or copyright_code not in ("Type1", "Type3")
            or not re.fullmatch(r"\d+", str(row.get("contentid") or ""))):
        return None
    author = str(row.get("photographer") or row.get("author") or "").strip() or None
    content_id = str(row.get("contentid") or "")
    return PlacePhoto(
        url=url, source_page=TOUR_DOCUMENT, provider="tourapi", publisher="한국관광공사 TourAPI",
        author=author, license="KOGL-1" if copyright_code == "Type1" else "KOGL-3",
        license_url=KOGL, can_modify=copyright_code == "Type1",
        description=str(row.get("title") or ""),
        match=(f"TourAPI contentId {content_id}", f"exact place title; distance {meters} m",
               "road address exact" if same_address else "provider object coordinates",
               "rights code on same response row as firstimage"),
    )


def gallery_photo(place: PhotoPlace, deadline: float) -> PlacePhoto | None:
    rows = kto_rows("PhotoGalleryService1", "gallerySearchList1",
                    os.getenv("TOUR_PHOTO_API_KEY", "").strip(), deadline, keyword=place.name)
    addr = road_address(place.address)
    for row in rows:
        title = str(row.get("galTitle") or "")
        photographer = str(row.get("galPhotographer") or "").strip()
        location = road_address(str(row.get("galPhotographyLocation") or ""))
        raw = str(row.get("galWebImageUrl") or "")
        url = official_url(_tour_image_url(raw) or raw,
                           {"phoko.visitkorea.or.kr", "tong.visitkorea.or.kr", "cdn.visitkorea.or.kr"})
        if normalize(title) == normalize(place.name) and addr and addr == location and photographer and url:
            return PlacePhoto(
                url=url, source_page=GALLERY_DOCUMENT, provider="gallery", publisher="한국관광공사 포토코리아",
                author=photographer, license="KOGL-1", license_url=KOGL, can_modify=True,
                description=title,
                match=(f"PhotoGallery {row.get('galContentId') or ''}", "exact photo title and shooting road address"),
            )
    return None


class PlainText(HTMLParser):
    def __init__(self, html: str):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.feed(html[:15_000])

    def handle_data(self, data: str):
        self.parts.append(data)

    @property
    def text(self) -> str:
        return " ".join(" ".join(self.parts).split())


def official_url(raw: str, hosts: set[str]) -> str | None:
    try:
        url = urllib.parse.urlsplit(raw)
        if (url.scheme == "https" and url.hostname in hosts and not url.port
                and not url.username and not url.password and url.path and not url.query and not url.fragment):
            return raw
    except ValueError:
        pass
    return None


def commons_media_url(raw: str) -> str | None:
    try:
        parsed = urllib.parse.urlsplit(raw)
        if any(key not in {"utm_source", "utm_campaign", "utm_content"}
               for key, _ in urllib.parse.parse_qsl(parsed.query, max_num_fields=4)):
            return None
        return official_url(parsed._replace(query="").geturl(),
                            {"upload.wikimedia.org", "thumb.wikimedia.org"})
    except ValueError:
        return None


def claims(entity: dict, key: str) -> list:
    values = []
    for claim in (entity.get("claims") or {}).get(key, []):
        if claim.get("rank") == "deprecated":
            continue
        snak = claim.get("mainsnak") or {}
        if snak.get("snaktype") == "value":
            values.append((snak.get("datavalue") or {}).get("value"))
    return values


def labels(entity: dict) -> list[str]:
    official = [value["value"] for value in (entity.get("labels") or {}).values()]
    aliases = [item["value"] for group in (entity.get("aliases") or {}).values() for item in group]
    return list(dict.fromkeys([*official, *aliases]))


def commons_photo(place: PhotoPlace, deadline: float) -> PlacePhoto | None:
    language = "ko" if re.search("[가-힣]", place.name) else "en"
    query = {"format": "json", "maxlag": 5}
    found = request_json(WIKIDATA, {**query, "action": "wbsearchentities", "language": language,
                                  "search": place.name, "limit": 6}, deadline).get("search", [])
    ids = [item["id"] for item in found if re.fullmatch(r"Q\d+", str(item.get("id")))]
    if not ids:
        return None
    records = request_json(WIKIDATA, {**query, "action": "wbgetentities", "ids": "|".join(ids),
                                    "props": "labels|aliases|claims", "languages": "ko|en"}, deadline).get("entities", {})
    matches = []
    target = normalize(place.name)
    for qid, entity in records.items():
        names = labels(entity)
        if not target or not any(target == normalize(name) for name in names):
            continue
        coordinates = [
            distance(place, point["latitude"], point["longitude"])
            for point in claims(entity, "P625") if isinstance(point, dict)
            and str(point.get("globe") or "").endswith("/Q2")
            and isinstance(point.get("latitude"), (int, float))
            and isinstance(point.get("longitude"), (int, float))
        ]
        if coordinates and min(coordinates) <= 160:
            matches.append((qid, entity, min(coordinates), names))
    if len(matches) != 1:
        return None
    qid, entity, meters, names = matches[0]
    filenames = [x for x in claims(entity, "P18") if isinstance(x, str)
                 and re.search(r"\.(jpe?g|png|webp)$", x, re.IGNORECASE)][:3]
    if not filenames:
        return None
    result = request_json(COMMONS, {**query, "action": "query", "formatversion": 2,
        "titles": "|".join("File:" + filename for filename in filenames),
        "prop": "imageinfo", "iiprop": "url|mime|size|extmetadata", "iiurlwidth": 960,
        "iiextmetadatafilter": "Artist|Credit|LicenseShortName|LicenseUrl|UsageTerms|ImageDescription|Restrictions|Attribution",
    }, deadline)
    for page in result.get("query", {}).get("pages", []):
        for info in page.get("imageinfo", []):
            photo = parse_commons(info, page.get("title", ""), qid, meters, names)
            if photo:
                return photo
    return None


def parse_commons(info: dict, title: str, qid: str, meters: int, names: list[str]) -> PlacePhoto | None:
    metadata = info.get("extmetadata") or {}
    def field(name: str) -> str:
        value = (metadata.get(name) or {}).get("value")
        return PlainText(value).text if isinstance(value, str) else ""

    author = field("Artist")
    attribution = field("Attribution")
    license_url = field("LicenseUrl")
    if license_url.startswith("http://creativecommons.org/"):
        license_url = "https://" + license_url[len("http://"):]
    if license_url.startswith("https://creativecommons.org/"):
        license_url = license_url.removesuffix("/deed.en").rstrip("/") + "/"
    license_match = re.fullmatch(r"https://creativecommons\.org/licenses/(by|by-sa)/(2\.0|2\.5|3\.0|4\.0)/", license_url)
    license_name = "CC " + license_match[1].upper() + " " + license_match[2] if license_match else ""
    if (not license_name or not author or len(author) > 220
            or re.search(r"^\s*(unknown|anonymous|not provided|see file|multiple authors)\b", author, re.I)
            or field("Restrictions") or info.get("mime") not in {"image/jpeg", "image/png", "image/webp"}):
        return None
    description = field("ImageDescription")
    caption = title + " " + description
    if re.search(r"\b(illustration|painting|portrait|logo|drawing|floor plan|location map)\b", caption, re.I):
        return None
    if not any(len(normalize(name)) >= 4 and normalize(name) in normalize(caption) for name in names):
        return None
    original = official_url(str(info.get("descriptionurl") or ""), {"commons.wikimedia.org"})
    image = commons_media_url(str(info.get("thumburl") or ""))
    if not image and isinstance(info.get("size"), int) and info["size"] <= 8_000_000:
        image = commons_media_url(str(info.get("url") or ""))
    if not original or not image:
        return None
    return PlacePhoto(url=image, source_page=original, provider="commons", publisher="Wikimedia Commons",
        author=author, license=license_name, license_url=license_url, can_modify=True,
        description=description[:400],
        attribution=attribution[:300],
        match=(f"Wikidata {qid}: exact Korean or English label/alias", f"P625 distance {meters} m",
               "P18 linked file, identity corroborated by Commons title/description"))

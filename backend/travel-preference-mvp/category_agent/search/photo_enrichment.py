"""Independent, bounded photo lookup. No recommendation or itinerary mutation."""
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from threading import BoundedSemaphore, Lock
from time import monotonic

from pydantic import BaseModel, Field

from .photo_sources import (
    PhotoPlace, PlacePhoto, SourceFailure, commons_photo, gallery_photo, photo_health, tour_photo,
)

_POOL = ThreadPoolExecutor(max_workers=4, thread_name_prefix="place-photo")
_SLOTS = BoundedSemaphore(12)  # bound running and queued lookups across requests
_LOCK = Lock()
_CACHE: OrderedDict[tuple, tuple[float, "PhotoResult"]] = OrderedDict()
_LOOKUP: dict[tuple, object] = {}
_PROVIDERS = (("tourapi", tour_photo), ("gallery", gallery_photo), ("commons", commons_photo))


class PhotoRequest(BaseModel):
    places: list[PhotoPlace] = Field(min_length=1, max_length=4)


class PhotoResult(BaseModel):
    id: str
    photo: PlacePhoto | None = None
    providers: dict[str, str] = Field(default_factory=dict)


def _resolve(place: PhotoPlace, deadline: float) -> PhotoResult:
    enabled = photo_health()
    statuses = {}
    selected = None
    for provider, lookup in _PROVIDERS:
        if not enabled[provider]:
            statuses[provider] = "not_configured"
            continue
        try:
            selected = lookup(place, deadline)
        except SourceFailure as exc:
            statuses[provider] = str(exc)
        except (TypeError, ValueError, KeyError, AttributeError):
            statuses[provider] = "invalid_response"
        else:
            statuses[provider] = "matched" if selected else "no_verified_match"
            if selected:
                break
    return PhotoResult(id=place.id, photo=selected, providers=statuses)


def _cache_key(place: PhotoPlace) -> tuple:
    return (place.name, place.address, place.latitude, place.longitude)


def _release(key: tuple, future) -> None:
    try:
        result = None if future.cancelled() else future.result()
        if result:
            verified_miss = all(value in {"no_verified_match", "not_configured"}
                                for value in result.providers.values())
            lifetime = 86_400 if result.photo else 900 if verified_miss else 20
            with _LOCK:
                _CACHE[key] = (monotonic() + lifetime, result)
                _CACHE.move_to_end(key)
                if len(_CACHE) > 384:
                    _CACHE.popitem(last=False)
    finally:
        with _LOCK:
            _LOOKUP.pop(key, None)
        _SLOTS.release()


def enrich_photos(request: PhotoRequest) -> list[PhotoResult]:
    deadline = monotonic() + 6.0
    pending = []
    for place in request.places:
        key = _cache_key(place)
        register = False
        with _LOCK:
            cache = _CACHE.get(key)
            future = _LOOKUP.get(key)
            if cache and cache[0] > monotonic():
                _CACHE.move_to_end(key)
                pending.append((place.id, cache[1], None))
                continue
            if future is None and _SLOTS.acquire(blocking=False):
                try:
                    future = _POOL.submit(_resolve, place, deadline)
                except BaseException:
                    _SLOTS.release()
                    raise
                _LOOKUP[key] = future
                register = True
        if register:
            future.add_done_callback(lambda completed, ref=key: _release(ref, completed))
        pending.append((place.id, None, future))

    results = []
    for place_id, cached, future in pending:
        if cached:
            results.append(cached.model_copy(update={"id": place_id}))
        elif future is None:
            results.append(PhotoResult(id=place_id, providers={"enrichment": "busy"}))
        else:
            try:
                found = future.result(timeout=max(0, deadline - monotonic()))
                results.append(found.model_copy(update={"id": place_id}))
            except TimeoutError:
                results.append(PhotoResult(id=place_id, providers={"enrichment": "deadline"}))
    return results

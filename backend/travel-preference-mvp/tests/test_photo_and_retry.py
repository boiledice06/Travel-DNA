from concurrent.futures import ThreadPoolExecutor
from threading import Event
from types import SimpleNamespace

import pytest
from google.genai import errors

from app.singleflight import run_once
from category_agent.llm.base import LlmMessage
from category_agent.llm.gemini import GeminiChatModel, classify_gemini_error
from category_agent.llm.upstream import ModelFailure
from category_agent.search import photo_sources as photos


def api_error(code, status, reason=None):
    details = [{"reason": reason}] if reason else []
    return errors.APIError(code, {"error": {"code": code, "status": status, "message": "fixture", "details": details}})


@pytest.mark.parametrize(("code", "reason", "expected"), [
    (400, "API_KEY_INVALID", "model_auth"),
    (400, None, "model_request"),
    (403, None, "model_auth"),
    (404, None, "model_not_found"),
    (429, None, "model_rate_limit"),
    (503, None, "model_unavailable"),
])
def test_gemini_separates_upstream_errors(code, reason, expected):
    assert classify_gemini_error(api_error(code, "fixture", reason)).code == expected


def test_sdk_retry_disabled_and_backoff_is_bounded(monkeypatch):
    calls = []
    sleeps = []
    def client(**kwargs):
        assert kwargs["http_options"].retry_options.attempts == 1
        assert kwargs["http_options"].timeout == 12000
        def generate_content(**values):
            calls.append(values)
            if len(calls) < 3:
                raise api_error(503, "UNAVAILABLE")
            return SimpleNamespace(text='{"result": "fixture"}')
        return SimpleNamespace(models=SimpleNamespace(generate_content=generate_content))
    monkeypatch.setattr("category_agent.llm.gemini.genai.Client", client)
    monkeypatch.setattr("category_agent.llm.gemini.time.sleep", sleeps.append)
    monkeypatch.setattr("category_agent.llm.gemini.random.uniform", lambda *_: 0)
    model = GeminiChatModel(api_key="test-key")
    assert model.complete([LlmMessage("user", "test")], response_json=True).text
    assert len(calls) == 3
    assert sleeps == [0.35, 0.7]


def test_quota_ends_after_one_attempt(monkeypatch):
    calls = []
    def generate(**kwargs):
        calls.append(kwargs)
        raise api_error(429, "RESOURCE_EXHAUSTED")
    client = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
    monkeypatch.setattr("category_agent.llm.gemini.genai.Client", lambda **kwargs: client)
    with pytest.raises(ModelFailure, match="model_rate_limit"):
        GeminiChatModel(api_key="fixture").complete([LlmMessage("user", "test")])
    assert len(calls) == 1


def test_singleflight_collapses_conflicting_and_replayed_requests():
    entered = Event()
    finish = Event()
    calls = []
    def work():
        calls.append("called")
        entered.set()
        assert finish.wait(3)
        return "result"
    def run():
        return run_once("chat", "isolation-fixture", "body", work, replay="retry-key")
    with ThreadPoolExecutor(2) as pool:
        first = pool.submit(run)
        assert entered.wait(3)
        second = pool.submit(run)
        finish.set()
        assert first.result(3) == second.result(3) == "result"
    assert run() == "result"
    assert calls == ["called"]


def museum():
    return photos.PhotoPlace(id="museum", name="국립중앙박물관", address="서울 용산구 서빙고로 137",
                             latitude=37.5239, longitude=126.9802)


@pytest.mark.parametrize(("delta", "rights", "accepted"), [
    (0, "Type3", True), (0, "", False), (0.003, "Type1", False),
])
def test_tourapi_requires_same_place_and_per_image_rights(monkeypatch, delta, rights, accepted):
    place = museum()
    row = {"title": place.name, "addr1": place.address, "mapy": place.latitude + delta, "mapx": place.longitude,
           "contentid": "42", "firstimage": "https://tong.visitkorea.or.kr/image.jpg", "cpyrhtDivCd": rights}
    monkeypatch.setattr(photos, "kto_rows", lambda *args, **kwargs: [row])
    result = photos.tour_photo(place, 0)
    assert bool(result) is accepted
    if result:
        assert not result.can_modify and result.license == "KOGL-3"


def test_commons_requires_photo_license_author_and_subject():
    info = {"thumburl": "https://thumb.wikimedia.org/wikipedia/commons/thumb/test.jpg?utm_source=commons",
            "descriptionurl": "https://commons.wikimedia.org/wiki/File:National_Museum.jpg",
            "mime": "image/jpeg", "extmetadata": {"Artist": {"value": "<b>Photographer</b>"},
                "LicenseUrl": {"value": "https://creativecommons.org/licenses/by-sa/3.0"},
                "ImageDescription": {"value": "National Museum of Korea"}}}
    result = photos.parse_commons(info, "National Museum of Korea", "Q42", 9, ["National Museum of Korea"])
    assert result and result.author == "Photographer" and not photos.urllib.parse.urlsplit(result.url).query
    assert not photos.parse_commons(info, "Museum", "Q42", 9, ["Unrelated Museum"])
    info["extmetadata"]["LicenseUrl"]["value"] = "https://creativecommons.org/licenses/by-nc/4.0/"
    assert not photos.parse_commons(info, "Museum", "Q42", 9, ["National Museum of Korea"])

def test_gallery_requires_shooting_address_and_photographer(monkeypatch):
    place = museum()
    row = {
        "galTitle": place.name, "galPhotographyLocation": place.address,
        "galContentId": "12", "galPhotographer": "Provided photographer",
        "galWebImageUrl": "https://phoko.visitkorea.or.kr/images/test.jpg",
    }
    monkeypatch.setattr(photos, "kto_rows", lambda *args, **kwargs: [row])
    approved = photos.gallery_photo(place, 0)
    assert approved and approved.author == row["galPhotographer"]
    row["galPhotographyLocation"] = "서울 용산구 다른로 65"
    assert photos.gallery_photo(place, 0) is None

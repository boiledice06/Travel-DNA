import io
import json
import urllib.error
import urllib.parse
from types import SimpleNamespace

import pytest

from category_agent.llm.base import LlmMessage
from category_agent.llm.gemini import GeminiChatModel
from category_agent.search.kakao_client import KakaoPlacesClient
from category_agent.search.schemas import PlaceCandidate
from category_agent.search.seoul_find import score_candidate
from category_agent.trip_profile import TripProfileCreate


class Response:
    def __enter__(self): return self
    def __exit__(self, *args): return False
    def read(self):
        return json.dumps({"documents": [
            {"id": "1", "place_name": "경복궁", "address_name": "서울 종로구", "road_address_name": "서울특별시 종로구 사직로", "x": "126.977", "y": "37.579", "category_name": "관광명소 > 궁", "place_url": "https://place.map.kakao.com/1"},
            {"id": "2", "place_name": "다른 지역", "address_name": "경기도 고양시", "x": "126.9", "y": "37.6"},
            {"id": "3", "place_name": "주소 없음", "x": "126.9", "y": "37.6"},
        ]}, ensure_ascii=False).encode()


def test_kakao_request_mapping_and_seoul_filter(monkeypatch):
    calls = []
    def mock(request, timeout):
        calls.append(request)
        return Response()
    monkeypatch.setattr("urllib.request.urlopen", mock)
    result = KakaoPlacesClient("test-key").text_search("서울 관광지", max_results=5, strict_location=True)
    assert len(calls) == 1
    req = calls[0]
    assert req.get_header("Authorization") == "KakaoAK test-key"
    assert urllib.parse.parse_qs(urllib.parse.urlsplit(req.full_url).query) == {"query": ["서울 관광지"], "size": ["5"]}
    assert len(result) == 1
    p = result[0]
    assert (p.name, p.place_id, p.lat, p.lng, p.category, p.source) == ("경복궁", "1", 37.579, 126.977, "관광명소 > 궁", "kakao")
    assert p.rating is None and p.user_ratings_total is None


def test_kakao_error_redaction(monkeypatch):
    def fail(request, timeout):
        raise urllib.error.HTTPError(request.full_url, 401, "secret test-key", {}, io.BytesIO(b'test-key'))
    monkeypatch.setattr("urllib.request.urlopen", fail)
    with pytest.raises(RuntimeError, match="Kakao HTTP 401") as exc:
        KakaoPlacesClient("test-key").text_search("서울")
    assert "test-key" not in str(exc.value)


def test_gemini_developer_config_and_chat(monkeypatch):
    calls = {}
    def client(**kwargs):
        calls.update(kwargs)
        def generate_content(**values):
            calls["request"] = values
            return SimpleNamespace(text='{"answer":"안녕하세요"}')
        return SimpleNamespace(models=SimpleNamespace(generate_content=generate_content))
    monkeypatch.setattr("category_agent.llm.gemini.genai.Client", client)
    model = GeminiChatModel(api_key="test-key")
    result = model.complete([LlmMessage("system", "한국어"), LlmMessage("user", "안녕")], response_json=True)
    assert calls["vertexai"] is False and calls["api_key"] == "test-key"
    assert calls["http_options"].api_version == "v1beta"
    assert calls["request"]["model"] == "gemini-3.5-flash-lite"
    assert calls["request"]["config"].response_mime_type == "application/json"
    assert result.provider == "gemini" and "안녕하세요" in result.text


def test_missing_rating_not_invented_in_score():
    profile = TripProfileCreate(party_size="2", companion_type="couple", duration="full_day", transport="walk_subway", time_window="afternoon").to_profile()
    place = PlaceCandidate(name="장소", source_keyword="관광지", source="kakao")
    score, reason = score_candidate(place, profile)
    assert score == 0 and reason is None
    assert place.rating is None and place.user_ratings_total is None
    categorized = place.model_copy(update={"category": "음식점 > 술집"})
    assert score_candidate(categorized, profile, must_avoid="술집")[0] is None

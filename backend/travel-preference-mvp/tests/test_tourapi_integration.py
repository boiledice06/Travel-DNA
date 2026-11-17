"""Offline tests for TourAPI parsing, source merging and lodging selection."""
import json
import urllib.parse

import pytest

from category_agent.search.schemas import PlaceCandidate
from category_agent.search.seoul_find import filter_and_shortlist, merge_candidates
from category_agent.search.tourapi import KoreaTourApiClient
from category_agent.trip_profile import TripProfileCreate


class Response:
    def __init__(self, body): self.body = body
    def __enter__(self): return self
    def __exit__(self, *args): return False
    def read(self): return self.body


def test_tourapi_request_and_mapping(monkeypatch):
    seen = []
    def urlopen(req, timeout):
        seen.append(req)
        data = {"response": {"header": {"resultCode": "0000"}, "body": {"items": {"item": [
            {"title": "박물관", "addr1": "서울특별시 종로구", "contentid": "123", "contenttypeid": "14", "mapy": "37.57", "mapx": "126.98"},
            {"title": "타지역", "addr1": "경기도 고양시", "contentid": "234", "mapy": "37.6", "mapx": "126.9"},
        ]}}}}
        return Response(json.dumps(data, ensure_ascii=False).encode())
    monkeypatch.setattr('urllib.request.urlopen', urlopen)
    results = KoreaTourApiClient('a%2Bb%2F%3D').keyword_search('박물관', max_results=5)
    query = urllib.parse.parse_qs(urllib.parse.urlsplit(seen[0].full_url).query)
    assert query['serviceKey'] == ['a+b/='] and query['areaCode'] == ['1']
    assert query['MobileOS'] == ['ETC'] and query['_type'] == ['json']
    assert len(results) == 1
    assert (results[0].place_id, results[0].lat, results[0].lng, results[0].category) == ('tourapi:123', 37.57, 126.98, '문화시설')


@pytest.mark.parametrize('body', [
    b'{"response":{"header":{"resultCode":"30"}}}',
    b'<OpenAPI_ServiceResponse><cmmMsgHeader><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>',
])
def test_tourapi_error_in_http_200_is_not_empty_success(monkeypatch, body):
    monkeypatch.setattr('urllib.request.urlopen', lambda *a, **k: Response(body))
    with pytest.raises(RuntimeError, match='TourAPI response error: 30'):
        KoreaTourApiClient('test-key').keyword_search('박물관')


def test_cross_source_merge_and_no_location_name_only():
    rows = [
        PlaceCandidate(name='서울 박물관', address='서울 종로구 1', lat=37.57, lng=126.98, place_id='1', source='kakao', source_keyword='박물관'),
        PlaceCandidate(name='서울박물관', address='서울특별시 종로구 1', lat=37.57001, lng=126.98001, place_id='tourapi:2', source='tourapi', source_keyword='박물관'),
        PlaceCandidate(name='서울 박물관', address='', place_id='tourapi:3', source='tourapi', source_keyword='박물관'),
    ]
    result = merge_candidates(rows)
    assert len(result) == 2
    assert result[0].sources == ['kakao', 'tourapi']
    assert result[0].source_ids == {'kakao': '1', 'tourapi': 'tourapi:2'}


def test_lodging_excluded_unless_explicitly_requested():
    profile=TripProfileCreate(party_size='2',companion_type='friends',duration='2n3d',transport='walk_subway',time_window='morning').to_profile()
    hotel=PlaceCandidate(name='호텔', category='여행 > 숙박 > 호텔', source_keyword='산책로', source='kakao')
    assert filter_and_shortlist([hotel], profile)[0] == []
    assert len(filter_and_shortlist([hotel], profile, must_have='호텔')[0]) == 1
    venue=PlaceCandidate(name='컨벤션센터', category='전시관', source_keyword='전시관', source='kakao')
    assert filter_and_shortlist([venue], profile, must_have='미술관')[0] == []
    assert len(filter_and_shortlist([venue], profile, must_have='박람회')[0]) == 1

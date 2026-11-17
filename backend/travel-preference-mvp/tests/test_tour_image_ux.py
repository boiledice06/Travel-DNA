from category_agent.search.schemas import PlaceCandidate
from category_agent.search.seoul_find import merge_candidates, filter_and_shortlist
from category_agent.search.tourapi import _tour_image_url
from category_agent.trip_profile import TripProfile

def test_official_image_restricted_and_merged_only_for_matching_place():
    url = _tour_image_url('http://tong.visitkorea.or.kr/cms/resource/photo.jpg')
    assert url == 'https://tong.visitkorea.or.kr/cms/resource/photo.jpg'
    assert _tour_image_url('https://evil.example/photo.jpg') is None
    a = PlaceCandidate(name='A', place_id='kakao:1', source='kakao', source_keyword='x', lat=37.5, lng=127.0)
    b = PlaceCandidate(name='A', place_id='tourapi:1', source='tourapi', source_keyword='x', lat=37.5, lng=127.0, image_url=url)
    c = PlaceCandidate(name='B', place_id='tourapi:2', source='tourapi', source_keyword='x', lat=37.5, lng=127.0, image_url=url)
    merged = merge_candidates([a, b, c])
    assert len(merged) == 2
    assert merged[0].image_url == url and merged[1].name == 'B'

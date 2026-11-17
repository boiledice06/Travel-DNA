"""Test-only HTTP app: real FastAPI routes and stores with injected external services."""
import json
import tempfile
from pathlib import Path

import app.main as main
import category_agent.dna_chat as chat
import category_agent.store as store
from category_agent.llm.base import LlmResponse
from category_agent.search.schemas import PlaceCandidate
from category_agent.seoul_run import run_seoul_pipeline

_tmp = tempfile.TemporaryDirectory(prefix='travel-dna-test-')
store._ROOT = Path(_tmp.name)
store._PROFILES = store._ROOT / 'profiles'
store._SESSIONS = store._ROOT / 'sessions'

class FakeLLM:
    provider = 'mock'
    model = 'mock'
    def complete(self, messages, **kwargs):
        if 'interviewer' in messages[0].content:
            payload = {'phase': 'constraints', 'assistant_message': '선호를 확인했습니다.', 'chips': [], 'draft_dna': None}
        else:
            payload = {'industries': ['카페', '공원', '갤러리']}
        return LlmResponse(text=json.dumps(payload, ensure_ascii=False), model=self.model, provider=self.provider)

class FakePlaces:
    def text_search(self, query, **kwargs):
        keyword = kwargs.get('source_keyword', '')
        offsets = {'카페': 0, '공원': 3, '갤러리': 6}
        base = offsets.get(keyword, 0)
        return [PlaceCandidate(name=f'가상 장소 {base+i}', place_id=f'mock-{base+i}', address='서울특별시', lat=37.48+(base+i)*0.02, lng=126.88+(base+i)*0.02, source_keyword=keyword, source='mock') for i in range(3)]

chat.get_chat_model = lambda: FakeLLM()
main.run_seoul_pipeline = lambda request: run_seoul_pipeline(request.model_copy(update={'use_tourapi': False}), llm=FakeLLM(), places_client=FakePlaces())
app = main.app

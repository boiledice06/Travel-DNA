"""Real FastAPI pre-auth HTTP checks; external services are never mocked.
Synthetic inputs only. Session storage is redirected to this experiment folder.
HTTP error bodies are inspected for classification but are not logged.
"""
import json, os, sys, threading, time, urllib.error, urllib.request
from pathlib import Path
from datetime import datetime, timezone
import uvicorn
RESULT_PATH = Path(__file__).resolve().parent / 'http-results.json'
if RESULT_PATH.exists():
    raise FileExistsError('Refusing to overwrite results: use a new experiment ID')
ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / 'backend' / 'travel-preference-mvp'
sys.path.insert(0, str(BACKEND))
import category_agent.store as store
import app.main as main
credential_names = ('GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_PLACES_API_KEY', 'GOOGLE_MAPS_API_KEY', 'TOUR_API_KEY', 'DATA_GO_KR_SERVICE_KEY')
adc_file = Path(os.environ.get('APPDATA', '')) / 'gcloud' / 'application_default_credentials.json'
if any(os.environ.get(name, '').strip() for name in credential_names) or adc_file.exists():
    raise RuntimeError('Pre-auth experiment refuses to run with external credentials configured')
store._ROOT = Path(__file__).resolve().parent / 'runtime-store'
store._PROFILES = store._ROOT / 'profiles'
store._SESSIONS = store._ROOT / 'dna_sessions'
config = uvicorn.Config(main.app, host='127.0.0.1', port=18775, log_level='critical', access_log=False)
server = uvicorn.Server(config)
thread = threading.Thread(target=server.run, daemon=True)
thread.start()
for _ in range(100):
    if server.started: break
    time.sleep(.1)
if not server.started:
    raise RuntimeError('Uvicorn startup failed')
results = {'date_utc': datetime.now(timezone.utc).isoformat(), 'test_type':'actual FastAPI, no injected mock; synthetic input', 'measurements': []}
def req(method, path, payload=None, label=None):
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8') if payload is not None else None
    request = urllib.request.Request('http://127.0.0.1:18775'+path, data=body, method=method, headers={'Content-Type':'application/json'})
    start=time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=70) as response:
            status=response.status; raw=response.read(); data=json.loads(raw) if path != '/docs' else {}
    except urllib.error.HTTPError as exc:
        status=exc.code; raw=exc.read(); data={}
        try: detail=str(json.loads(raw).get('detail','')).lower()
        except (ValueError, AttributeError): detail=''
        category='credential_error' if any(w in detail for w in ('credential', 'authentication', 'application default')) else 'unclassified_error'
    entry={'step':label or path, 'status':status, 'elapsed_ms':round((time.perf_counter()-start)*1000,1)}
    if status >= 400: entry['error_category']=category
    results['measurements'].append(entry)
    return status,data
try:
    req('GET','/docs',label='docs')
    status,health=req('GET','/api/health',label='health')
    results['configuration']={'places_configured':health.get('places_configured'), 'tourapi_configured':health.get('discovery',{}).get('tourapi_configured'), 'adc_default_file_present':health.get('adc_file_present'), 'llm_provider':health.get('llm_provider')}
    answers_by_case={'A':[5,1,1,4,3], 'B':[1,5,5,5,3]}
    for case,values in answers_by_case.items():
        _,profile=req('POST','/api/trip-profile',{'party_size':'2','companion_type':'friends','duration':'2n3d','transport':'walk_subway','budget_level':'mid','time_window':'morning'},f'{case}:profile')
        _,start=req('POST','/api/dna-chat/start',{},f'{case}:start')
        if not profile.get('id') or not start.get('session_id'): continue
        items=start.get('likert_items',[])
        _,survey=req('POST','/api/dna-chat/likert',{'session_id':start['session_id'],'answers':[{'id':item['id'],'value':v} for item,v in zip(items,values)]},f'{case}:likert')
        results['measurements'][-1]['returned_phase']=survey.get('phase')
        phrase='조용한 독립서점과 전시를 좋아해요' if case=='A' else '유명 관광지와 활동적인 체험을 좋아해요'
        req('POST','/api/dna-chat/message',{'session_id':start['session_id'],'message':phrase},f'{case}:vertex_chat')
        # API allows constraints immediately after Likert; this checks the local contract,
        # not an AI conversation or a validation of final personalization.
        want='독립서점, 전시' if case=='A' else '관광지, 체험'
        avoid='혼잡' if case=='A' else ''
        req('POST','/api/dna-chat/constraints',{'session_id':start['session_id'],'must_have':want,'must_avoid':avoid},f'{case}:constraints_after_likert')
        _,final=req('POST','/api/dna-chat/finalize',{'session_id':start['session_id'],'confirm':True},f'{case}:finalize')
        results['measurements'][-1]['returned_phase']=final.get('phase')
        req('POST','/api/seoul-find',{'profile_id':profile['id'],'dna_session_id':start['session_id'],'total_slots':4,'places_max_per_keyword':1,'shortlist_size':4},f'{case}:find')
    req('POST','/api/places-search',{'city':'서울','keywords':['박물관']},'places_search_without_key')
finally:
    server.should_exit=True
    thread.join(timeout=10)
RESULT_PATH.write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(results,ensure_ascii=False,indent=2))

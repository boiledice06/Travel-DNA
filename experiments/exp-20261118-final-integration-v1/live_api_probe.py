import json, urllib.request, urllib.error
from pathlib import Path
base='http://127.0.0.1:8767'
out=Path('experiments/exp-20261118-final-integration-v1/live-api-results.json')
results={}
def post(path, data):
    req=urllib.request.Request(base+path, data=json.dumps(data,ensure_ascii=False).encode(), headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=180) as response:
            body=json.load(response)
            results[path]={'status':response.status,'body':body}
            out.write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
            return body
    except urllib.error.HTTPError as e:
        results[path]={'status':e.code,'error':e.read().decode('utf-8',errors='replace')[:500]}
        out.write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
        raise
p=post('/api/trip-profile',{'party_size':'2','companion_type':'friends','duration':'2n3d','transport':'walk_subway','budget_level':'mid','time_window':'afternoon'})
s=post('/api/dna-chat/start',{})
sid=s['session_id']
turn=post('/api/dna-chat/likert',{'session_id':sid,'answers':[{'id':i['id'],'value':3} for i in s['likert_items']]})
for n in range(5):
    if turn['phase']!='asking': break
    turn=post('/api/dna-chat/message',{'session_id':sid,'message':'조용한 박물관과 미술 전시를 보고 한적한 곳을 산책하고 싶어요.'})
turn=post('/api/dna-chat/constraints',{'session_id':sid,'must_have':'박물관, 미술관','must_avoid':'술집'})
post('/api/dna-chat/finalize',{'session_id':sid,'confirm':True})
r=post('/api/seoul-find',{'profile_id':p['id'],'dna_session_id':sid})
print(json.dumps({'statuses':{k:v['status'] for k,v in results.items()},'sources':{source:sum(1 for x in r.get('shortlist',[]) if x.get('source')==source) for source in ('kakao','tourapi')},'images':sum(bool(x.get('image_url')) for x in r.get('shortlist',[]))},ensure_ascii=False))

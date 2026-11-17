# 별도 UI 연동 가이드

마스터 개요: [mvp-overview.md](./mvp-overview.md) · 코드 번들: [api-bundle-manifest.md](./api-bundle-manifest.md)

## 권장 구조

- **FastAPI 백엔드 유지** (`app.main:app`) — `/api/*` 가 계약.
- **내장 UI 무시/교체**: `app/static/index.html` 과 `GET /` 는 데모용. 별도 프론트는 사용하지 않아도 됨.
- 프론트는 `profile_id` + `dna_session_id` 를 클라이언트 상태(또는 라우트)에 보관한 뒤 `POST /api/seoul-find` 에 전달.

기본 base URL (로컬): `http://127.0.0.1:8765`

```powershell
cd C:\Users\semin\travel-preference-mvp
uv sync
# 별도 UI origin 예: http://localhost:5173
# .env 에 CORS_ALLOW_ORIGINS=http://localhost:5173
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8765
```

---

## CORS / base URL

| 항목 | 내용 |
|------|------|
| 상태 | `CORS_ALLOW_ORIGINS` 가 **비어 있으면 CORS 미들웨어 비활성** (같은 오리진·프록시만 OK) |
| 설정 | 쉼표 구분 origin. 예: `http://localhost:3000,http://127.0.0.1:5173` |
| 동작 | `allow_credentials=True`, methods/headers `*` |
| 프로덕션 | 프론트 origin만 명시. `*` 와 credentials 동시 사용 금지 패턴 주의 |
| 프록시 대안 | Vite/Next rewrite로 `/api` → `127.0.0.1:8765` 하면 CORS 없이도 가능 |

프론트 fetch 시 `credentials: "include"` 가 필요 없으면 omit 해도 됨 (현재 API는 쿠키 세션 없음 — id는 body/path).

---

## UI 화면 시퀀스

```text
[1 물류 폼] → profile_id
[2 Likert 5문항] → session_id (start 후)
[3 DNA 채팅] → phase asking → constraints
[4 원하는/피할 것] → draft
[5 확정 확인] → confirmed
[6 결과] → seoul-find shortlist
```

1. TripProfile 제출 → 응답의 `id` 저장  
2. DNA 시작 → `likert_items` 렌더 → 5개 답변 제출  
3. `assistant_message` / `chips` 로 채팅 UI (`phase` 가 `constraints` 가 될 때까지 message 반복)  
4. must_have / must_avoid 제출  
5. finalize (`confirm: true`)  
6. `profile_id` + `dna_session_id` 로 seoul-find → shortlist 카드

`GET /api/dna-chat/{session_id}` 로 새로고침 복구 가능.

---

## DNA phase 순서 (필수)

```text
likert → (likert 제출) → asking → (message×N) → constraints
      → (constraints 제출) → draft → (finalize) → confirmed
```

- `seoul-find` 는 **`phase=confirmed`** 이고 `confirmed_dna` 가 있어야 함. 아니면 400.  
- constraints 전에 finalize 하면 안 됨 (서버 ValueError).  
- 채팅 turn 상한: soft ~3, hard ~5 후 constraints 유도.

---

## API 계약 (메인 플로우)

모든 JSON. 키/시크릿은 요청에 넣지 않음.

### `GET /api/health`

응답 요약: `ok`, `mode`, `itinerary: false`, `travel_dna: "likert_then_chat"`, `places_configured`, `discovery`, Vertex 메타(프로젝트/모델 **이름**).

---

### `POST /api/trip-profile`

**Request**

| field | type | 필수 | 값 |
|-------|------|------|-----|
| `party_size` | string | ✓ | `"1"` \| `"2"` \| `"3-4"` \| `"5+"` |
| `companion_type` | string | ✓ | `"solo"` \| `"couple"` \| `"friends"` \| `"family"` \| `"with_kids"` |
| `age_band` | string | | `"teens"`…`"60plus"` \| `"skip"` (기본 skip) |
| `gender` | string | | `"female"` \| `"male"` \| `"other"` \| `"skip"` |
| `duration` | string | ✓ | `"half_day"` \| `"full_day"` \| `"1n2d"` |
| `lodging` | string | | `"none"` \| `"has"` |
| `lodging_area` | string\|null | | lodging=has 일 때 권역 |
| `transport` | string | ✓ | `"walk_subway"` \| `"bus_ok"` \| `"taxi_car"` \| `"minimize"` |
| `mobility_preference` | string | | `"high_mobility"` \| `"balanced"` \| `"one_neighborhood"` |
| `budget_level` | string | | `"low"` \| `"mid"` \| `"high"` |
| `budget_note` | string\|null | | |
| `time_window` | string | ✓ | `"morning"` \| `"afternoon"` \| `"evening"` |

도시·id는 서버 할당 (`city` 항상 `서울`).

**Response**: TripProfile 전체 (`id`, `city`, 위 필드, `created_at`).

### `GET /api/trip-profile/{profile_id}`

저장본 조회. 없으면 404.

---

### `POST /api/dna-chat/start`

Body 없음.

**Response**

| field | 설명 |
|-------|------|
| `session_id` | DNA 세션 id |
| `phase` | `"likert"` |
| `turn` | 0 |
| `assistant_message` | 보통 빈 문자열 |
| `chips` | [] |
| `likert_items` | 5문항 `{id, statement_ko, maps_to, scale[{value,label_ko}]}` |
| `scale_labels` | `{5:"매우 그렇다",…,1:"매우 그렇지 않다"}` |

문항 id: `ax_authenticity`, `ax_energy`, `ax_density`, `ax_novelty`, `ax_setting`.

---

### `POST /api/dna-chat/likert`

**Request**: `{ "session_id": "...", "answers": [ {"id":"ax_authenticity","value":1..5}, … 5개 ] }`  
5개 id 모두 필요.

**Response**: `session_id`, `phase` (`asking`), `turn`, `assistant_message`, `chips`, `seed_dna`, `draft_dna`, `followups[{axis_or_pillar, reason, suggested_chips}]`.

`TravelDNA` 형태:

```json
{
  "pillars": { "do_play": 0.25, "see_learn": 0.25, "stay_vibe": 0.25, "eat_local": 0.25 },
  "axes": {
    "authenticity": -1.0,
    "energy": 0.0,
    "density": 0.0,
    "novelty": 0.0,
    "setting": 0.0
  },
  "micro_keywords": []
}
```

---

### `POST /api/dna-chat/message`

**Request**: `{ "session_id", "message": "…", "chip": null | "칩텍스트" }`  
`phase` 가 `asking` 또는 `constraints`(메시지 허용 여부는 서버 — 보통 asking)일 때.

**Response**: `session_id`, `phase`, `turn`, `assistant_message`, `chips`, `draft_dna`, `must_have`, `must_avoid`.

---

### `POST /api/dna-chat/constraints`

**Request**: `{ "session_id", "must_have"?: string, "must_avoid"?: string }` (각 max 500, 빈 문자열 → null)

**Response**: `phase` → `"draft"`, 동일 세션 필드 + draft_dna / must_*.

---

### `POST /api/dna-chat/finalize`

**Request**: `{ "session_id", "confirm": true, "edits"?: TravelDNA }`  
`confirm` 이 false면 확정 안 됨.

**Response**: `session_id`, `phase`=`"confirmed"`, `travel_dna`, `must_have`, `must_avoid`, `provider`, `model`.

---

### `GET /api/dna-chat/{session_id}`

세션 스냅샷 (`DnaChatSession`: phase, messages, seed/draft/confirmed dna, constraints 플래그 등).

---

### `POST /api/seoul-find` (alias `POST /api/seoul-run`)

profile + **확정된** DNA → 업종 LLM → Places shortlist.

**Request**

| field | type | 기본 | 설명 |
|-------|------|------|------|
| `profile_id` | string | 필수 | TripProfile id |
| `dna_session_id` | string | 필수 | confirmed DNA session |
| `total_slots` | int 1–30 | 12 | 업종 슬롯 |
| `run_places` | bool | true | false면 업종만 |
| `places_max_per_keyword` | int | 3 | |
| `micro_kinds_per_keyword` | int | 2 | |
| `shortlist_size` | int 4–20 | 16 | |
| `use_tourapi` | bool | true | 키 없으면 자동 skip |

**Response (요약)**

| field | 설명 |
|-------|------|
| `profile` | TripProfile |
| `travel_dna` | 확정 DNA |
| `constraints` | 물류 + `must_have`/`must_avoid` |
| `industries` / `micro_industries` | 업종명 문자열 리스트 |
| `slot_allocation` | pillar → 개수 |
| `provider` / `model` | LLM |
| `city` | `"서울"` |
| `shortlist` | `SeoulPlaceHit[]` |
| `find` | 검색 메타 (keywords, excluded_count, sources_used, …) |
| `filters_applied` | 적용 필터 라벨 |
| `places` | legacy dump (shortlist 중복 가능) |

`SeoulPlaceHit`: `name`, `address`, `rating`, `place_id`, `source_keyword`, `source`, `maps_url`, `lat`, `lng`, `score`, `user_ratings_total`.

필터: DNA `must_avoid` → 이름/주소 **하드 제외**; `must_have` → **소프트 가산**; TripProfile 예산·동행·이동·숙소권역 → 소프트 점수.

---

## 레거시 / 보조 엔드포인트

별도 UI 메인 경로에는 불필요. 있으면 유지:

| Method | Path | 용도 |
|--------|------|------|
| POST | `/api/nl-pipeline` | 자연어 → DNA + 업종 |
| POST | `/api/industry-plan` | 숫자 DNA → 업종 |
| POST | `/api/recommend` | industry-plan 별칭 |
| POST | `/api/places-search` | 도시·키워드 Places (서울 플로우 밖) |

---

## seoul-find 가 소비하는 id

```text
profile_id     ← POST /api/trip-profile 응답의 id
dna_session_id ← POST /api/dna-chat/start 의 session_id
                 (finalize 후 phase=confirmed 여야 함)
```

서버는 `data/mvp_store/profiles/` · `data/mvp_store/dna_sessions/` 에 JSON 저장.  
프론트는 id만 넘기면 되고, DNA/제약은 세션에서 읽음.

---

## Sample: fetch (키 없음)

```javascript
const API = "http://127.0.0.1:8765";

async function runFlow() {
  const profile = await fetch(`${API}/api/trip-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      party_size: "2",
      companion_type: "couple",
      duration: "full_day",
      transport: "walk_subway",
      time_window: "afternoon",
      budget_level: "mid",
      mobility_preference: "balanced",
      lodging: "none",
      age_band: "skip",
      gender: "skip",
    }),
  }).then((r) => r.json());

  const started = await fetch(`${API}/api/dna-chat/start`, { method: "POST" }).then((r) =>
    r.json(),
  );

  const answers = started.likert_items.map((it) => ({ id: it.id, value: 4 }));
  await fetch(`${API}/api/dna-chat/likert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: started.session_id, answers }),
  }).then((r) => r.json());

  // … UI에서 message / constraints 반복 …

  await fetch(`${API}/api/dna-chat/constraints`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: started.session_id,
      must_have: "독립서점",
      must_avoid: "번화가",
    }),
  });

  await fetch(`${API}/api/dna-chat/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: started.session_id, confirm: true }),
  });

  const result = await fetch(`${API}/api/seoul-find`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profile_id: profile.id,
      dna_session_id: started.session_id,
      total_slots: 12,
      shortlist_size: 16,
      run_places: true,
    }),
  }).then((r) => r.json());

  return result.shortlist;
}
```

## Sample: curl

```bash
curl -s http://127.0.0.1:8765/api/health

curl -s -X POST http://127.0.0.1:8765/api/trip-profile \
  -H "Content-Type: application/json" \
  -d "{\"party_size\":\"2\",\"companion_type\":\"couple\",\"duration\":\"full_day\",\"transport\":\"walk_subway\",\"time_window\":\"afternoon\"}"

curl -s -X POST http://127.0.0.1:8765/api/dna-chat/start

# likert / message / constraints / finalize / seoul-find 는 위 fetch와 동일 JSON
```

스모크 스크립트(서버 기동 후): `uv run python scripts\smoke_shipped_flow.py`

---

## 번들 위치

- 폴더: `C:\Users\semin\travel-preference-mvp\dist\api-bundle\`
- Zip: `C:\Users\semin\travel-preference-mvp\dist\travel-preference-mvp-api-bundle.zip`

번들 README → 이 가이드(스토어 경로)를 가리킴. 시크릿·`.env`·`data/mvp_store` 개인 런은 제외됨.

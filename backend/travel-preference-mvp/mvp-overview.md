# Travel Preference MVP — 마스터 개요

코드: `C:\Users\semin\travel-preference-mvp`  
별도 UI 붙이기: [ui-integration-guide.md](./ui-integration-guide.md) · 번들 목록: [api-bundle-manifest.md](./api-bundle-manifest.md)

## 한눈에 (오늘 배포 범위)

```text
┌─────────────────┐     ┌──────────────────────────────────────────────┐
│ TripProfile     │     │ Travel DNA                                   │
│ (물류 폼만)      │     │ Likert 5축 → adaptive chat → constraints    │
│ POST /trip-     │     │ → finalize                                   │
│   profile       │     │                                              │
└────────┬────────┘     └───────────────────┬──────────────────────────┘
         │  profile_id                      │  dna_session_id (phase=confirmed)
         └────────────────┬─────────────────┘
                          ▼
              POST /api/seoul-find  (alias: /api/seoul-run)
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
     업종명·마이크로명   Places(+선택 TourAPI)   shortlist
     (LLM from DNA)     서울 {업종} 검색        must_avoid 하드 제외
                                                must_have 소프트 가산
```

**일정(동선) 엔진 없음.** 결과는 장소 shortlist까지.

---

## End-to-end 단계

| # | 단계 | API | 산출 |
|---|------|-----|------|
| 1 | TripProfile 물류 폼 | `POST /api/trip-profile` | `profile_id`, 도시=`서울` |
| 2 | DNA 세션 시작 | `POST /api/dna-chat/start` | `session_id`, `phase=likert`, 문항 5개 |
| 3 | 5축 Likert | `POST /api/dna-chat/likert` | seed DNA → `phase=asking` |
| 4 | Adaptive DNA chat | `POST /api/dna-chat/message` (반복) | micro keywords · followups |
| 5 | must_have / must_avoid | `POST /api/dna-chat/constraints` | `phase=draft` |
| 6 | DNA 확정 | `POST /api/dna-chat/finalize` | `phase=confirmed`, `travel_dna` |
| 7 | 업종 → 서울 장소 | `POST /api/seoul-find` | industries + shortlist |

내장 UI 실행: [run-shipped-flow.md](./run-shipped-flow.md) · 원리 요약: [seoul-flow-how-it-works.md](./seoul-flow-how-it-works.md)

---

## Exact 5 axes (Likert)

문항 id · 축 · 의미 (점수 1→−1 … 5→+1, 결정적 매핑 `category_agent/likert.py`):

| id | axis | −1 쪽 | +1 쪽 | 문항 요지 |
|----|------|-------|-------|-----------|
| `ax_authenticity` | authenticity | landmark | hidden/local | 랜드마크보다 골목·로컬 |
| `ax_energy` | energy | 정적(rest/static) | 활동적(active) | **활동적 ↔ 정적** (바쁘게/여유 일정 아님) |
| `ax_density` | density | quiet/private | crowded/hotspot | 핫플·번화가 |
| `ax_novelty` | novelty | classic/familiar | unusual | 새롭고 낯선 경험 |
| `ax_setting` | setting | indoor/urban | nature/outdoor | 야외·자연 |

척도 라벨: 5 매우 그렇다 … 1 매우 그렇지 않다.  
Pillars(`do_play` 등)는 폼에 없음 — 미드 시드 후 채팅에서 조정 가능.

---

## 제약 위치

| 항목 | 위치 | 역할 |
|------|------|------|
| 인원·동행·기간·이동·예산·시간대·숙소 | TripProfile | 물류 하드/소프트 |
| `must_have` / `must_avoid` | DNA 세션 (자유 텍스트) | 장소 필터 (가산 / 하드 제외) |

---

## 포함 / 미포함

| 포함 | 미포함 |
|------|--------|
| TripProfile 물류 폼 | 일정·동선·시간표 엔진 |
| Likert 5축 → DNA seed | Visit Seoul **실연동** (stub/deferred) |
| Adaptive DNA chat + chips | 설문 기반 전체 취향 폼 (legacy survey deferred) |
| must_have / must_avoid | 도시 자유 변경 (서울 고정) |
| LLM 업종·마이크로명 | Reddit/SNS 2-hop 등 extension hooks |
| Places API (New) shortlist | 랜드마크 DB 강제 경로 |
| 선택 TourAPI (없으면 Places만) | |
| 레거시 `nl-pipeline` / `industry-plan` / `places-search` | |

---

## 환경 변수 (이름만 — 값 금지)

| 변수 | 용도 |
|------|------|
| `TRAVEL_MVP_LLM_PROVIDER` | 기본 `vertex` |
| `VERTEXAI_PROJECT` | Vertex 프로젝트 |
| `VERTEXAI_LOCATION` | 예: `global` |
| `VERTEXAI_MODEL` | 예: `gemini-3.8-flash` |
| `GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_LOCATION` | 위 Vertex 별칭 |
| ADC (`gcloud auth application-default login`) | Vertex 인증 (파일 경로·키 값 문서화 금지) |
| `GOOGLE_PLACES_API_KEY` | 서울 장소 찾기 필수 |
| `GOOGLE_MAPS_API_KEY` | Places 키 별칭 |
| `TOUR_API_KEY` | 선택 TourAPI |
| `DATA_GO_KR_SERVICE_KEY` | TourAPI 별칭 |
| `VISITSEOUL_API_KEY` | 선택·미연동 stub |
| `CORS_ALLOW_ORIGINS` | 별도 UI용 허용 origin (쉼표 구분). 비어 있으면 CORS 미들웨어 비활성 |

`.env` / ADC / 실제 키는 커밋·문서·로그에 넣지 마세요. 예시 파일: 프로젝트 `.env.example`.

---

## 관련 문서

| 문서 | 내용 |
|------|------|
| [ui-integration-guide.md](./ui-integration-guide.md) | 별도 프론트 API 계약·CORS·화면 순서 |
| [api-bundle-manifest.md](./api-bundle-manifest.md) | 이전용 zip/폴더 파일 목록 |
| [seoul-flow-how-it-works.md](./seoul-flow-how-it-works.md) | 서울 플로우 짧은 원리 |
| [run-shipped-flow.md](./run-shipped-flow.md) | 내장 UI 실행·클릭 순서 |
| [dna-likert-intake-plan.md](./dna-likert-intake-plan.md) | Likert 설계 |
| [dna-likert-smoke.md](./dna-likert-smoke.md) | Likert 경로 스모크 |
| [seoul-place-discovery-plan.md](./seoul-place-discovery-plan.md) | 장소 발견 계획 |
| [recommendation-plan.md](./recommendation-plan.md) | 제품 방향·deferral |
| [project-context.md](./project-context.md) | 프로젝트 인덱스 |

---

## 로컬 서버 (참고)

```powershell
cd C:\Users\semin\travel-preference-mvp
pwsh -File scripts\run_demo.ps1
# → http://127.0.0.1:8765/
```

헬스: `GET /api/health` — `itinerary: false`, `travel_dna: likert_then_chat`, Places/Tour 설정 여부.

# 서울 추천 흐름 — 이렇게 동작합니다

테스트 도시는 **서울** 고정입니다.  
코드: `C:\Users\semin\travel-preference-mvp`

> Taste intake: **Likert(5 axes) → adaptive DNA chat → must_have/must_avoid → finalize**.  
> **마스터 개요:** [mvp-overview.md](./mvp-overview.md) · **별도 UI 연동:** [ui-integration-guide.md](./ui-integration-guide.md) · 번들: [api-bundle-manifest.md](./api-bundle-manifest.md)  
> Details: [dna-likert-intake-plan.md](./dna-likert-intake-plan.md) · run book: [run-shipped-flow.md](./run-shipped-flow.md)

## 한눈에

```text
TripProfile(물류 폼) ──┐
                       ├──▶ 업종명·마이크로명 ──▶ 서울 장소 검색 ──▶ shortlist
TravelDNA(설문→채팅→제약) ──┘
         must_avoid = 하드 제외 · must_have = 소프트 가산
```

1. **TripProfile** — 여행 *물류*만 폼 (인원·동행·기간·이동·예산 등). **avoid/want 없음**  
2. **TravelDNA** — 설문 5문항(취향 축) → 시드 DNA → 구체 취향 채팅 → must_have/must_avoid → 확정  
3. **업종명** — DNA로 짧은 업종/마이크로 이름 리스트 생성  
4. **서울 장소 찾기** — `서울 {업종}` Places(+선택 TourAPI) → 필터 → shortlist  

**일정(동선) 엔진은 없습니다.**

---

## 1. TripProfile (물류 폼)

UI **「1. TripProfile」** 또는 `POST /api/trip-profile`

| 항목 | 방식 |
|------|------|
| 인원·동행·기간·이동·예산·시간대 등 | 선택(select) |
| 연령·성별 | 선택 + **건너뛰기** |
| 도시 | 항상 `서울` |

`must_avoid` / `must_have`는 **DNA 세션**에 있습니다 (폼 아님).

---

## 2. TravelDNA (설문 → 채팅 → 제약)

UI **「2. Travel DNA」**

| 단계 | API |
|------|-----|
| 시작 (설문 패널) | `POST /api/dna-chat/start` → `phase=likert`, `likert_items[5]` |
| 설문 제출 | `POST /api/dna-chat/likert` `{session_id, answers[{id,value:1-5}]}` → seed DNA → `asking` |
| 구체 취향 | `POST /api/dna-chat/message` |
| 원하는/피할 것 | `POST /api/dna-chat/constraints` `{must_have?, must_avoid?}` → `draft` |
| 확정 | `POST /api/dna-chat/finalize` `{session_id, confirm:true}` |

척도: **매우 그렇다 … 매우 그렇지 않다** (5점).  
시드는 `category_agent/likert.py`에서 결정적 매핑 (LLM이 base DNA를 만들지 않음).

문항 = **5 taste axes** (`authenticity`, `energy`, `density`, `novelty`, `setting`).  
`energy` = **활동적 vs 정적** (바쁘게 다니기/여유 일정 아님). Pillars는 폼에 없음(미드 시드).

---

## 3. 업종명 → 서울 장소 찾기

```http
POST /api/seoul-find
{
  "profile_id": "<저장한 id>",
  "dna_session_id": "<확정한 세션>",
  "total_slots": 12,
  "shortlist_size": 16,
  "run_places": true
}
```

필터:

- DNA `must_avoid` → 이름/주소 토큰 **하드 제외**
- DNA `must_have` → 매칭 시 **소프트 가산**
- TripProfile 예산·동행·이동·숙소권역 → 소프트 점수

모듈: `category_agent/seoul_run.py`, `category_agent/search/seoul_find.py`

---

## UI로 실행

```powershell
cd C:\Users\semin\travel-preference-mvp
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8765
```

브라우저: http://127.0.0.1:8765/

1. 물류 폼 → **TripProfile 저장**  
2. **DNA 시작** → 설문 5문항 제출 → 채팅 → 원하는/피할 것 제출 → **DNA 확정**  
3. **서울에서 찾기**

---

## 환경 변수 (이름만)

| 변수 | 용도 |
|------|------|
| `TRAVEL_MVP_LLM_PROVIDER` | 기본 `vertex` |
| `VERTEXAI_PROJECT` / `VERTEXAI_LOCATION` / `VERTEXAI_MODEL` | DNA·업종 LLM |
| ADC (`gcloud auth application-default login`) | Vertex 인증 |
| `GOOGLE_PLACES_API_KEY` (또는 `GOOGLE_MAPS_API_KEY`) | 장소 찾기 |
| `TOUR_API_KEY` (또는 `DATA_GO_KR_SERVICE_KEY`) | 선택 |
| `CORS_ALLOW_ORIGINS` | 별도 UI origin (쉼표). 비우면 CORS 끔 |

키 값은 문서·로그에 넣지 마세요. 전체 목록: [mvp-overview.md](./mvp-overview.md).

---

## 포함 / 미포함

| 포함 | 미포함 |
|------|--------|
| Likert 5 axes → DNA seed → chat → constraints → seoul shortlist | 일정/동선 엔진 |
| Places (+ optional TourAPI) | Visit Seoul 실연동 |

# 실제 외부 API 검증 보고

검증일: 2026-11-17 (Asia/Seoul). 실험 ID `exp-20261117-live-api-preflight-v1`; 실행 당시 코드 `98acc4abc0349fe62af4cd0a94e28f77f9285d56`. 이 보고는 **실제 외부 추천 성공 보고가 아니다**. 사용자는 현재 인증 없이 가능한 검증을 요청했다. 합성 입력만 사용했고 실제 키·토큰과 오류 상세는 기록하지 않았다.

## API 및 인증 상태

| 대상          | 확인 결과                                                                                                                                                                                 | 실제 외부 성공 여부                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| FastAPI       | 모의 주입 없는 `app.main:app`을 로컬에서 실행. `/docs` 200.                                                                                                                               | 로컬 HTTP 확인                       |
| Vertex AI     | `google-genai`의 Vertex 경로는 ADC, 프로젝트·리전·모델을 사용. 현재 환경에서 ADC 파일·환경변수·`gcloud` 미확인. A/B 대화와 검색 키워드 생성은 로컬 API 502, 오류 상세는 인증 오류로 분류. | 미성공. 모델 호출·대화 품질은 미검증 |
| Google Places | 서버 키 환경변수 없음. 독립 `/api/places-search`는 로컬 503. API 활성화·과금 상태는 계정에 접근할 수 없어 미확인.                                                                         | 외부 요청 미실행                     |
| TourAPI       | 키 환경변수 없음. 서버가 선택적 제공자로 구성돼 있으나 이번에는 호출하지 않음.                                                                                                            | 외부 요청 미실행                     |

이 프로세스에서 `GOOGLE_PLACES_API_KEY`, `GOOGLE_MAPS_API_KEY`, `TOUR_API_KEY`, `DATA_GO_KR_SERVICE_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`, `VERTEXAI_PROJECT`, `GOOGLE_CLOUD_PROJECT`, `VERTEXAI_LOCATION`, `VERTEXAI_MODEL`은 비어 있었고 백엔드 `.env`는 없었다. 이는 다른 쉘이나 계정에 설정된 값의 부재를 보장하지 않는다. 서버 `app/main.py`에는 번들 작성자가 지정한 기본 프로젝트·모델이 있어 환경변수가 비어 있어도 그 기본값이 사용된다. 해당 기본 프로젝트가 사용자의 프로젝트이거나 접근 권한이 있다고 가정하면 안 된다. `/api/health`의 ADC 표시는 기본 파일 존재만 검사하며 ADC 전체 유효성 검사가 아니다.

## 실제 FastAPI HTTP 관찰

두 합성 사용자 A(조용한 독립서점·전시, 혼잡 기피)와 B(활동·유명 관광지)는 각각 별도 프로필과 세션을 사용했다. 외부 서비스를 모의하지 않았으며 테스트 세션 파일만 격리했다. 전체 단계별 코드와 경과 시간은 [HTTP 결과](../experiments/exp-20261117-live-api-preflight-v1/http-results.json)와 [재현 스크립트](../experiments/exp-20261117-live-api-preflight-v1/run_preflight.py)를 참조한다.

| 단계               | A                | B                | 범위                                                 |
| ------------------ | ---------------- | ---------------- | ---------------------------------------------------- |
| `2n3d` 프로필 생성 | 200, 31.4 ms     | 200, 5.3 ms      | 로컬 입력 검증·파일 저장                             |
| Likert 제출        | 200, 18.2 ms     | 200, 40.2 ms     | 서버 phase `asking`                                  |
| Vertex 대화        | 502, 13,129.4 ms | 502, 12,044.7 ms | 인증 실패. 성공 응답이 아님                          |
| 필수·제외 제출     | 200              | 200              | 대화 실패 후 서버가 허용하는 경로로 직접 제출        |
| DNA 확정           | 200, 28.5 ms     | 200, 49.2 ms     | 설문 시드 기반의 로컬 계약 확인. AI 대화 확정이 아님 |
| 장소 추천          | 502, 12,037.1 ms | 502, 12,084.6 ms | Vertex 인증 실패로 키워드·Places 호출 이전에 중단    |

`/docs`와 `/api/health`는 200, 키 없는 `/api/places-search`는 503이었다. 각 A/B는 1회이며 오류 시간은 성공 지연시간이 아니다. 통계적 중앙값·최대시간으로 품질이나 성능을 추정하지 않았다. 정상 외부 호출 전체 시간과 프런트 일정 생성 시간은 측정할 실제 결과가 없어 미측정이다.

## 계약·데이터 흐름 조사

- Vertex는 서버 쪽 `google-genai` `genai.Client(vertexai=True)`와 ADC를 사용한다. 기본 모델의 실제 프로젝트 접근 권한과 사용 가능 여부는 인증 후 확인해야 한다. [Google ADC 설정](https://docs.cloud.google.com/docs/authentication/provide-credentials-adc), [Gemini 3.8 Flash 모델 안내](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-8-flash).
- Places는 `POST https://places.googleapis.com/v1/places:searchText`, `X-Goog-Api-Key`, 명시적 Field Mask(id, 표시명, 주소, 좌표, 평점, 리뷰 수, 지도 URI, 가격 수준)를 사용하며 요청당 timeout은 25초다. 초기 검색은 서울 중심 반경 22km restriction, 실패 시 bias로 재시도한다. 두 방식 모두 서울 행정구역 경계를 보장하지 않는다. Places 검색은 과금될 수 있으며 필드에 따라 SKU가 달라진다. [공식 Text Search 계약](https://developers.google.com/maps/documentation/places/web-service/text-search), [사용량·과금](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing).
- TourAPI는 `searchKeyword2`, `serviceKey`, `areaCode=1`, `_type=json`, `keyword`, `mapx`/`mapy`를 사용하며 요청당 timeout은 25초다. 키가 없으면 건너뛴다. 실제 서비스 키 형식, 호출 성공 및 응답 분류·서울 해당 여부는 미검증이다. 현재 변환 모델은 별도 관광 분류 코드를 유지하지 않는다.
- 백엔드는 최대 14개 키워드에 대해 Places를 검색하고 실패 시 각 키워드를 한 번 더 시도한다. TourAPI는 최대 8개 키워드를 검색한다. 사용량이 커질 수 있으므로 실제 A/B 시험 전 호출 비용과 한도를 확인한다. 클라이언트의 대화 timeout은 30초, `/api/seoul-find`는 120초다. Vertex SDK 호출에는 코드상 별도 timeout이 명시돼 있지 않다.
- 서버 중복 제거는 Google ID 또는 정규화한 동일 이름과 약 120m 근접성에 의존한다. 프런트는 제공자와 외부 ID를 조합하고 서울 대략 사각형 밖·좌표 누락을 제외한다. 이 사각형과 22km 원은 행정경계 검증이 아니다. 공급자 사이 이름·좌표가 다른 중복과 서울 인접 지역 유입 가능성을 실제 결과로 검토해야 한다.
- 제외 조건은 이름·주소·검색 키워드에 대한 문자열 검사다. 제외하려는 속성이 그 텍스트에 없거나 표현이 다르면 걸러지지 않을 수 있다. 실제 결과의 제외 조건 준수는 미검증이다. 사용자별 실제 키워드·장소 수·지역 분포·Day 1–3, 이동거리 및 A/B 차이는 결과가 없어 계산하지 않았다.
- 서버 URL이 없을 때만 프런트는 로컬 데모를 사용한다. 서버를 설정한 오류를 모의 성공으로 바꾸지 않는다. `tests.http_mock_app`은 별도 테스트 서버이며 실제 공급자가 아니다.

## 수정 사항 및 검사

공급자 요청이 모두 예외로 끝나도 빈 성공 결과로 처리되는 문제를 회귀 테스트로 먼저 재현했다. 이후 모든 검색 시도가 실패할 때 일반 오류를 반환하도록 수정했다. 정상적으로 성공한 빈 결과는 여전히 빈 배열이며, 원본 제공자 오류 문자열을 노출하지 않는다. 일부 호출만 실패한 경우의 구체적인 공급자별 상태는 여전히 반환되지 않는다. 별도의 테스트는 모의 의존성에 의한 코드 검증이며 실제 인증 오류 응답 테스트가 아니다.

- `npm run typecheck` 통과, `npm test` 24개 통과, `npm run format:check` 통과.
- 백엔드 pytest 수정 후 31개 통과. Web·Android export 성공; 실기기 검증 아님.
- `npx expo-doctor@latest` 19/20: 기존 SDK 58 패키지 9개 권장 버전 차이. SDK·lockfile은 임의 변경하지 않았다.
- 실제 외부 추천이 없어 `docs/screenshots/live-api/`를 생성하거나 모의 스크린샷을 실제 결과로 제출하지 않았다. Expo Web의 실데이터 지도, 날짜 전환·마커 동기화·상세·패널은 미검증이다.

## 나중에 인증 후 재검증하는 방법

1. 사용자가 소유·사용 권한이 있는 Cloud 프로젝트에서 Vertex AI와 Places API (New)의 접근 권한·결제·할당량을 확인한다. 프로젝트 생성이나 결제 설정 변경은 수행하지 않았다.
2. 로컬 개발 환경에 Google Cloud CLI를 설치한 뒤 사용자가 직접 `gcloud auth application-default login`을 실행하거나 조직에서 승인한 ADC 방식을 사용한다. 비밀이나 토큰은 채팅에 붙여넣지 않는다. [ADC 검색 순서](https://docs.cloud.google.com/docs/authentication/application-default-credentials).
3. `backend/travel-preference-mvp/.env.example`을 참고해 서버에서만 `VERTEXAI_PROJECT`, `VERTEXAI_LOCATION`, `VERTEXAI_MODEL`, `GOOGLE_PLACES_API_KEY`(또는 `GOOGLE_MAPS_API_KEY`), `TOUR_API_KEY`(또는 `DATA_GO_KR_SERVICE_KEY`)를 설정한다. 실제 사용 가능한 모델·리전을 프로젝트에서 확인한다. `.env`는 Git에 넣지 않는다.
4. 서버를 `uv run uvicorn app.main:app --host 127.0.0.1 --port 8765`로 구동하고 웹 출처를 `CORS_ALLOW_ORIGINS`에 설정한다. Expo에는 공개 서버 URL만 `EXPO_PUBLIC_RECOMMENDATION_SERVER_URL`로 지정한다.
5. 인증이 확인되면 새로운 실험 ID를 만들고 A/B를 각각 최소 횟수로 실행한다. 제공자별 결과와 필터·중복·서울 행정경계, 3일 직선거리 및 실제 비용을 분리 기록한다. 실제 성공 화면만 `live-api` 폴더에 저장한다.

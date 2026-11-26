# 서울 2박 3일 추천과 사진 보강 검증

실험 `exp-20261125-image-enrichment` · 2026-11-25 Asia/Seoul

기준 `cffd8d4` · 구현 `7b737db`, `65eebc1` · Windows Edge, Expo Web 390 × 844

## 사진 확보율

분모는 반환된 고유 장소 후보 16곳이다. 현재 일정은 기존과 같이 상위 15곳에 배정된다. 보강 전 수치는 원본 응답의 대표 이미지 URL 보유 수이고, 보강 후 수치는 같은 입력의 장소 검증과 라이선스 판정을 통과한 사진 수다.

| 실제 서울 후보                                           | 추천 후보 | 보강 전 |    보강 후 | 사진 공급원         | 브라우저 디코딩 |
| -------------------------------------------------------- | --------: | ------: | ---------: | ------------------- | --------------: |
| 보존한 기존 통합 사례, TourAPI 장소 6·카카오 장소 10     |        16 |       0 |    8 (50%) | TourAPI 4·Commons 4 |             8/8 |
| 새 실제 실행 첫 검토, TourAPI 장소 3·카카오 장소 13      |        16 |       2 | 5 (31.25%) | TourAPI 3·Commons 2 |             5/5 |
| 새 실제 실행 두 번째 검토, TourAPI 장소 5·카카오 장소 11 |        16 |       3 | 3 (18.75%) | TourAPI 3           |             3/3 |
| 최종 실제 실행, TourAPI 장소 9·카카오 장소 7             |        16 |       6 |  6 (37.5%) | TourAPI 6           |             6/6 |

기존 사례는 대표 이미지 필드를 넣기 전의 실제 스냅샷이다. 카카오 장소 10곳 중 4곳에 Commons 사진이 붙었다. 새 실제 실행의 첫 검토에서는 카카오 장소 3곳에 별도 공급원의 사진을 붙였다. 이어진 두 실행에서는 카카오 후보에 검증 기준을 충족하는 사진이 없었다. 집계는 공급자별 사진 확보율의 제한된 관찰이다.

판정된 사진에는 라이선스와 장소 일치 근거를 모두 기록했다. 기존 사례의 Commons 사진 4장은 저작자가 확인됐다. 기존 사례와 최종 실행의 TourAPI 행에는 별도 저작자 표기가 없었다. 포토코리아는 기존 키로 호출 시 HTTP 403이며 사진 확보 수에 포함하지 않았다. [사진별 출처·라이선스·판정](PHOTO_SOURCES.md) · [공급원별 승인과 기준](CHANGES.md)

## 지연 및 로딩

- 기존 16곳의 사진 엔진은 4개 배치를 사용했다. 콜드 조회는 **7,057ms**였고 배치별로 1,747·2,274·1,552·1,485ms였다. 같은 요청의 웜 캐시는 **25ms**였다.
- 최종 실제 실행에서 추천 HTTP 응답은 요청 후 **5,320ms**에 도착했다. 사진 API 첫 요청은 응답 후 **127ms**에 시작됐고 Day 1 지도는 **129ms**에 확인됐다. 당시 완료된 사진 배치는 0개였다. 초기 네 배치는 웜 캐시에서 각각 5·10·9·5ms에 응답했다. 이 시점 측정은 지도 표시와 사진 응답을 분리해 확인한 값이다.
- 정상 로딩은 승인된 각 고유 URL을 브라우저에서 실제 디코딩해 확인했다. 강제 실패 검사는 성공률 측정 뒤 한 URL을 의도적으로 차단했다. `after/07-vector-fallback.png`와 `live/07-vector-fallback.png`에서 라벨과 카테고리별 일러스트가 보인다.

## 실제 Gemini·카카오·TourAPI 흐름

최종 브라우저에서 여행 조건 → 설문 → 실제 Gemini 메시지 → 필수·제외 조건 → 확정 → 실제 카카오·TourAPI 추천을 실행했다. 핵심 POST는 모두 HTTP 200이었다. 최종 앱 실행의 Gemini 모델 호출 3회는 모두 첫 시도에서 성공했다. 모델 로그의 소요 시간은 2,215·1,587·875ms였다. 사전 검사에서는 6.5초 서버 기한이 Gemini 400을 만들었고 14초와 기본 기한이 성공했다. 이전 upstream 503에서 FastAPI 502가 된 사례와 구분해 기록했다. 503의 연속 실패와 복구, 429에서 한 번만 호출하는 동작은 자동 테스트로 확인했다. [정제한 공급자 로그](backend-diagnostics.json)

## UI 회귀

- `before/`와 `after/`는 서울역사박물관을 같은 기존 추천으로 열었다. `live/`는 최종 실제 실행이다. 지도 패널, 확장 목록, 상세와 일정에서 사진을 확인했다. [전후 비교](before-after.png)
- 기존 일정과 새 추천에서 드래그 중 추천 패널이 **81 CSS px** 움직인 뒤 Expanded로 열렸다. 장소 상세, 찜 저장과 새로고침, 기기에 저장된 후보 ID와 순서가 유지됐다. 브라우저 JavaScript 예외는 관찰되지 않았다.
- 짧은 대화의 제목과 메시지·입력란 배치를 시각적으로 재검토했다. 작은 화면을 흉내 내도록 뷰포트 높이를 844px에서 620px로 줄였을 때 입력란이 화면에 남았다. 새 DNA 패널에는 서버에서 받은 키워드와 조건만 표시했다. [대화 캡처](live/01-chat.png) · [확정 캡처](live/02-confirmed-dna.png)
- TypeScript `typecheck`, Prettier `format:check`, 프런트엔드 테스트 **31/31**, 백엔드 pytest **65/65**가 통과했다. Expo Web과 Android export를 완료했다. Android 기동, 네이티브 OS 키보드와 실제 기기 제스처는 검증 범위에 포함되지 않았다.

## 재현

기존 로컬 `.env`, 가상환경과 의존성을 사용한다.

```powershell
# backend/travel-preference-mvp
$env:CORS_ALLOW_ORIGINS = 'http://localhost:8091,http://127.0.0.1:8091'
& .venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8778 --no-access-log

# 다른 터미널의 프로젝트 루트
$env:EXPO_PUBLIC_RECOMMENDATION_SERVER_URL = 'http://127.0.0.1:8778'
npm run web -- --port 8091
```

Playwright 검증은 `TRAVEL_PLAYWRIGHT`에 기존 Playwright 경로를 지정하거나 Node가 설치된 Playwright를 찾는 환경에서 실행한다. Edge를 사용하며 API 요청은 검증 스크립트를 통해 위 로컬 서버에 전달된다. 새 복제본이나 재설치 없이 진행했다.

```powershell
$env:EXPO_PUBLIC_RECOMMENDATION_SERVER_URL = 'http://127.0.0.1:8778'
$env:EXPO_OFFLINE = '1'
npx expo export --platform web --output-dir .codex-temp/image-enrichment-polished-web
node presentation/image-enrichment/verify.cjs live .codex-temp/image-enrichment-polished-web
node presentation/image-enrichment/verify.cjs after .codex-temp/image-enrichment-polished-web presentation/image-enrichment/historical-metrics.json
python presentation/image-enrichment/measure.py presentation/image-enrichment/historical-metrics.json .codex-temp/image-enrichment-repeat.json
python presentation/image-enrichment/build-artifacts.py
```

기준 캡처는 변경 전 `cffd8d4`의 기존 Expo Web 번들로 동일 후보를 복원했다. 세 브라우저 실행의 요청과 결과는 각 폴더의 `evidence.json`에 있다.

# Travel DNA 잔여 수정 및 검증

- 실험 ID `exp-20261118-final-polish-v1`; 2026-11-18 Asia/Seoul. 시작 revision `1140048`, 브랜치 `codex/seoul-three-day-integration`.
- Windows Edge, Expo Web 390×844. 이전 실험 `exp-20261118-final-integration-v1`에서 같은 브라우저에 저장된 실제 추천 15곳을 다시 사용했다. 이번 실험에서 Gemini·Kakao·TourAPI를 새로 호출하지 않았다. 테스트 대화는 로컬 모의 서버 응답이다.

## 결과

| 항목 | 결과 | 근거 및 제한 |
| --- | --- | --- |
| 카테고리 필터 | PASS | 전체 후보로 일정과 순번을 먼저 만들고 각 날짜 안에서만 필터링하도록 변경. 실제 저장 추천의 Day 1과 Day 3 원래 순서 확인. 문화 필터의 Day 2는 빈 상태, 해제하면 원래 Day 2 다섯 곳 복원. 테스트에서 빈 날짜, 복원 및 찜 필터를 확인. |
| 찜과 마커 | PASS | Day 2 첫 장소 저장 및 해제 후 번호 유지. 두 번째 마커 선택 후 카드 2/5로 동기화. 저장 장소 필터는 현재 일정의 저장된 장소만 표시한다. |
| Bottom Sheet | BLOCKED | 핸들은 44px 높이, PanResponder의 수직 8px 활성화·20px 스냅 기준, 자식 Pressable과 이벤트 경쟁 가능성을 확인했다. 실제 포인터 드래그를 시도했으나 상태가 바뀌지 않았다. 캡처 단계 조정 후에도 동일하여 수정안을 되돌렸다. 자동화 입력의 문제인지 앱 제스처 결함인지는 분리하지 못했다. 드래그 성공 스크린샷 없음. 버튼 확장·축소와 확장 목록 스크롤은 작동했고 하단 탭과 겹치지 않았다. |
| 대화 응답 | PARTIAL | 모의 서버가 `asking`과 질문을 반환할 때 프런트 상태 및 화면에 질문이 남고 입력 가능함을 확인. 스크린샷은 **모의 응답**이다. 실제 Gemini 생성 질문 화면은 미검증. 백엔드는 모델이 `constraints`를 반환할 때 생성 문장을 고정 조건 안내로 대체하므로 이전 실험의 빠른 전환은 그 경로와 일치한다. 생성 알고리즘·대화 흐름은 변경하지 않았다. |
| 사진 fallback | PARTIAL | 이미지 URL 없는 실제 Kakao 장소의 카드와 상세에서 카테고리별 fallback 확인. 잘못된 외부 호스트는 기존 `safeTourImage` 단위 테스트가 빈 값으로 거부함. 이미지 요청 실패 시 `Photo`의 `onError`가 fallback 상태로 전환되는 코드를 확인했으나 실패 요청의 브라우저 실행은 미검증이다. |
| 사진 출처 및 이용 | PASS / 제한 | 사진 상세에 기존 한국관광공사 출처를 유지하고 피사체 권리·기업 CI/BI 제한과 공식 안내 링크를 추가했다. [공공데이터포털 국문 관광정보 서비스](https://www.data.go.kr/data/15101578/openapi.do)는 공공누리 1·3유형 이미지와 해당 제한을 안내한다. 개별 사진의 유형은 확인되지 않아 단정하지 않는다. |

## 코드 및 검사

- `src/features/recommendations/MapHome.tsx`, `mapFilters.ts`: 날짜·순서가 있는 원래 일정에서 표시 장소만 필터링. 연결선도 표시된 장소만 연결한다. 필터링 후 선은 실제 이동 경로가 아니다.
- `src/features/recommendations/PlaceDetail.tsx`: 이미지 없는 상세에서 기존 공통 카테고리 fallback 사용, 사진 이용 안내 추가.
- `tests/map-filters.test.ts`: 날짜별 필터, 빈 날짜, 복원, 저장 장소와 원본 불변성 검사.
- 변경 관련 테스트 `node --experimental-strip-types --test tests/map-filters.test.ts tests/itinerary.test.ts tests/tour-image.test.ts tests/backend-flow.test.ts`: 7/7 통과. `npm run typecheck`: 통과. 변경 파일 Prettier 검사 통과. 전체 테스트, Expo Doctor 및 Android export는 요청 범위에 따라 재실행하지 않았다.

## 화면 증거

`verification/final-polish-screenshots/`의 `category-filter-before.png`, `category-filter-after.png`, `category-filter-day2-empty.png`, `category-filter-day2-restored.png`, `image-fallback.png`, `photo-attribution.png`는 실제 브라우저 캡처다. `gemini-chat-visible.png`는 모의 질문 화면이며 Gemini 실응답 캡처가 아니다. 파일은 화면 내용을 열어 확인했다. 드래그 성공 캡처는 만들지 않았다. 이전 실제 관광 사진과 전체 흐름은 `verification/FINAL_INTEGRATION_REPORT.md` 및 `verification/final-e2e-screenshots/` 참조.

## 재현 및 한계

Expo를 `EXPO_OFFLINE=1`, `EXPO_PUBLIC_RECOMMENDATION_SERVER_URL=http://127.0.0.1:8767`, `npm run web -- --port 8084`로 실행했다. 모의 대화는 `node experiments/exp-20261118-final-polish-v1/mock-chat-server.cjs`를 사용하며 8084에만 CORS를 허용한다. 기존 추천은 이전 실험에서 해당 브라우저의 8084 origin에 저장된 세션이다. 외부 API 결과는 시점에 따라 달라지며 시드·데이터셋 버전은 없다. 네이티브·터치·실제 Gemini 신규 호출은 범위에서 제외했다.

기존 커밋 `0b438ad`, `d98dd09`, `1140048`은 그대로 유지한다. 이번 변경 커밋은 Git 로그를 참조한다. 원격 push는 하지 않았다.

Drive [실험 ZIP](https://drive.google.com/file/d/1VzlEqMkK6KB-DUh10CwgxRz_1UPkOxVb/view)은 이 보관 문단 추가 전 스냅샷이다. 부모 폴더, 크기 350,363바이트와 다운로드 참조를 확인했으나 체크섬은 제공되지 않았다. 로컬 자료는 보존한다. 새 ZIP 자체는 아카이브 사본으로 유지하며 임시 모의 서버 및 과거 export는 삭제하지 않았다.

# Travel DNA Expo Web E2E 검증 보고서

- 실험 ID: `exp-20261118-expo-web-e2e-v1`; 실행일: 2026-11-18 (Asia/Seoul)
- 기준 코드: `ca3b39c`, 브랜치 `codex/seoul-three-day-integration`, 실행 전부터 백엔드에 미커밋 변경이 존재함. 결과는 이 작업 트리를 대상으로 함.
- 환경: Windows, Microsoft Edge 실제 브라우저, Expo Web, 모바일 뷰포트 요청 390 × 844 (캡처 이미지 390 × 843). 실기기 검증 아님.
- 백엔드: `uv run uvicorn app.main:app --host 127.0.0.1 --port 8765`; 이번 실행에서 `CORS_ALLOW_ORIGINS=http://localhost:8081,http://127.0.0.1:8081` 지정.
- 프런트: `EXPO_PUBLIC_RECOMMENDATION_SERVER_URL=http://127.0.0.1:8765` 설정 후 `npm run web -- --port 8081`; 앱 URL http://localhost:8081/ ; 시작 화면 http://localhost:8081/onboarding .
- 처음에는 CORS 환경 설정 없이 OPTIONS `/api/trip-profile`가 405여서 연결 실패. 이번에 시작한 백엔드만 위 환경 설정으로 재시작한 뒤 OPTIONS와 요청 성공. 프로젝트 설정 파일 변경 없음.

## 실제 API 및 데이터 출처

이전 `.codex-temp/tourapi-integration-b977b6ffbe/flow-result.json` 및 `itinerary.json`은 존재하지만 이번 UI에 주입하지 않았다. 이번 브라우저에서 새 세션을 만들고 `/api/dna-chat/message`, `/api/dna-chat/finalize`, `/api/seoul-find`가 HTTP 200을 반환했다. 서버 health는 Gemini, Kakao 및 TourAPI 설정을 표시했고 코드에서 message는 설정된 모델의 `complete`를 호출한다. 따라서 이 대화 요청은 Gemini 호출을 거쳤다. 다만 Gemini가 한 턴 후 조건 입력으로 전환하여 AI가 생성한 후속 문장 자체는 화면에 남지 않았고 대화 스크린샷도 확보하지 못했다. 실제 검색 반환의 UI에는 `kakao`와 `tourapi` 출처가 표시된다. 저장된 이전 응답은 이번의 새 호출 증거가 아니다. 지도 배경은 Kakao 지도가 아닌 OpenStreetMap 타일이다.

## 단계별 결과

| 단계 | 상태 | 근거 및 한계 |
| --- | --- | --- |
| Expo Web/백엔드 실행과 연결 | PASS | 브라우저 렌더링 및 CORS 수정 후 실제 요청 200 |
| 시작 화면 | 부분 | `/onboarding` 직접 방문으로 캡처. 기존 브라우저 저장 데이터 때문에 시작 화면부터 한 세션으로 진행하지 않음 |
| 서울 2박 3일, 인원·예산 | PASS | 2명, 친구, 도보·지하철, 보통; 목적 조용한 박물관·미술 전시·산책 |
| Likert 설문 | PASS | 5개 응답 후 제출 성공. 캡처는 렌더링 타이밍 때문에 4/5 상태 |
| AI 대화 | 부분 | 취향 답변 제출 및 message 200; 즉시 조건 단계로 이동. 실제 Gemini 대화 캡처 미확보 |
| 필수·제외 조건 및 DNA 확정 | PASS | 박물관·미술관, 술집; 확인 화면 후 finalize 200 |
| 실제 장소 검색 | PASS | `/api/seoul-find` 200, 서버 추천 15곳 표시, 양 출처 확인 |
| 날짜 전환과 순서 | PASS | Day 1–3 각 5개; 각 날짜 접근성 트리에서 번호와 카드 순서 일치. 각 마커를 개별 클릭해 모두 검증한 것은 아님 |
| 마커 선택 및 상세 | PASS | Day 1 국립중앙박물관 마커 선택 후 카드 2/5와 지도 중심 변경, 상세 주소·kakao 출처 및 복귀 확인 |
| Bottom Sheet | 부분 | collapsed, compact, expanded 버튼 전환 확인; 드래그 제스처는 미검증 |
| 모바일 레이아웃 | FAIL | 긴 Day 2/3 장소명 라벨이 오른쪽 저장 버튼과 겹치고, 지도 마커 일부가 가장자리/상단 컨트롤 또는 시트에 가려짐. 긴 카드 제목·주소는 말줄임 |
| 콘솔 | 부분 | 브라우저 도구가 수집한 error/warn 목록은 비어 있음. 초기 CORS 실패는 서버 OPTIONS 405와 UI 연결 실패로 관측했으며, 콘솔 로그 전체 보존은 없음 |

직선 연결선과 지도 타일 및 마커는 실제 화면에서 보였다. 연결선은 실제 이동 경로가 아니다. 장소별 운영 시간이나 실제 동선의 타당성은 검증하지 않았다. 지도 번호와 목록은 접근성 트리상 각 날짜에서 1–5로 일치한다.

## 스크린샷 검토

모두 실제 Edge에서 캡처하고 파일을 열어 시각적으로 확인했다. 세로 화면은 390 × 843 PNG. 각 스크린샷의 최초 화면만 보이며 스크롤 밖 콘텐츠는 포함하지 않는다.

| 파일 | 실제 표시 및 데이터 |
| --- | --- |
| `e2e-screenshots/01-start.png` | 온보딩 소개, 서울 여행 시작; 직접 진입, 외부 추천 데이터 없음 |
| `e2e-screenshots/02-trip-setup.png` | 2박 3일 설정 폼, 인원·동행·이동·예산; 입력 데이터 |
| `e2e-screenshots/03-likert.png` | 설문 4/5 응답 순간; 실제로는 이후 5개 모두 제출 |
| `e2e-screenshots/04-ai-chat.png` | **없음**: 대화 제출 후 전환되어 캡처하지 못함 |
| `e2e-screenshots/05-dna-result.png` | 확정 직전 목적 및 필수·제외 조건; 입력한 테스트 데이터 |
| `e2e-screenshots/06-day1-map.png` | 실제 TourAPI 김세중미술관, Day 1 지도·선·카드 |
| `e2e-screenshots/07-day2-map.png` | 실제 Kakao 서울둘레길, Day 2 지도·카드; 긴 이름과 버튼 겹침 |
| `e2e-screenshots/08-day3-map.png` | 실제 TourAPI 북악하늘길, Day 3 지도·카드; 긴 이름과 버튼 겹침 |
| `e2e-screenshots/09-place-detail.png` | 실제 Kakao 국립중앙박물관 상세, 주소 및 출처 |
| `e2e-screenshots/10-bottom-sheet-expanded.png` | 실제 서버 추천 Day 1 목록 확장, 두 출처와 순서 |

## 테스트와 남은 일

- `npm test`: 24/24 통과. `npm run typecheck`: 통과. `npm run format:check`: 통과. 백엔드 `uv run --extra dev pytest -q`: 50/50 통과. 이는 UI 검증과 별개다.
- 기존 사용자 브라우저에 온보딩 데이터가 있어 첫 화면부터의 연속 흐름은 입증하지 못했다. 별도 격리된 브라우저 프로필에서 재검증이 필요하다.
- 재현: 390px 폭에서 서버 추천 후 Day 2 또는 Day 3을 선택하면 긴 선택 마커의 오른쪽이 저장 버튼과 겹친다. 전체 마커 노출 및 시트 드래그를 별도 확인할 것.
- `04-ai-chat.png` 미확보와 모바일 겹침으로 전체 E2E 합격 및 커밋 조건을 충족하지 못했다. 커밋하지 않았다.
- API 키와 `.env` 내용은 이 보고서에 포함하지 않았다. 기존 미커밋 파일은 스테이징하지 않았다.

## 보관 상태

[Google Drive 실험 보관 폴더](https://drive.google.com/drive/folders/1DV_HCR2JTH1jNNginbIreOVrP0rz1aIx)에 보고서·실험 README·스크린샷의 ZIP을 업로드했다. Drive 메타데이터와 파일 다운로드 참조를 재조회했으며 크기 410,558바이트는 로컬 ZIP과 일치한다. 연결 도구가 MD5를 반환하지 않아 체크섬 일치는 검증하지 못했다. ZIP은 이 보관 상태 문단 추가 직전 버전이다.

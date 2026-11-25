# Travel DNA UI V2 실행 검증

2026-11-25 Asia/Seoul · 실험 `exp-20261125-presentation-ui-v2`
비교 기준 `a3d604d` · 최종 구현 `9ff7109` · `codex/presentation-ui-v2`

## Expo Web 및 fixture

Windows Edge 158.0.4370.33에서 Expo Web을 실행했다. `before/390x844/`는 소스를 수정하기 전에 만든 기준 번들의 실행 캡처다. `after/`에는 최종 구현의 캡처와 각 실행의 `evidence.json`이 있다. 세 크기에서 인트로 → 데모 온보딩 → 지도 → 여행 조건 → 서버 형식의 설문·대화 → 필수·제외 조건 → 취향 확정 → 추천 → Day 1–3 → 장소 상세 → 북마크 → 내 여행 → 취향 프로필을 실행했다.

| 뷰포트    | 전체 흐름        | 포인터 드래그 중 이동 → 스냅 | 터치 드래그 중 이동 → 스냅 | 확장 목록 스크롤 |
| --------- | ---------------- | ---------------------------- | -------------------------- | ---------------- |
| 375 × 812 | 통과 · 28개 기록 | 85.5 CSS px → Expanded       | 138 CSS px → Compact       | 184 CSS px       |
| 390 × 844 | 통과 · 28개 기록 | 85.5 CSS px → Expanded       | 138 CSS px → Compact       | 178 CSS px       |
| 430 × 932 | 통과 · 28개 기록 | 85.5 CSS px → Expanded       | 138 CSS px → Compact       | 176 CSS px       |

- 포인터와 터치를 놓기 전에 손잡이의 수직 위치를 측정했다. 확장 목록 내부의 세로 스크롤로는 패널 높이가 변하지 않았다. 가로 카드 스와이프 후 카드 2와 덕수궁 핀이 함께 선택됐다.
- 미응답 설문의 제출은 비활성 상태였다. 대화 요청에 502를 한 번 주입해 입력 보존과 재전송 뒤 진행을 확인했다. 답변을 기다리는 상태는 `06a-chat-wait.png`, 오류와 보존된 입력은 `06b-chat-retry.png`에 있다.
- 날짜를 연속 변경한 뒤 Day 1이 선택됐다. Day 3의 fixture 핀 3개가 지도 영역에 있었고 상세에서 돌아왔을 때 Day 3을 유지했다. 날짜 선택과 실사용 지점 구성은 `11-day1.png`, `12-day2.png`, `14-day3.png`에 있다.
- 북마크 저장 후 새로고침, 여행 기록 추가·수정·새로고침·삭제, 사진 URL이 없는 장소의 상세 대체 화면을 확인했다.
- 입력에 포커스를 둔 채 뷰포트 높이를 255px 줄인 실험에서 입력창이 보이는 범위에 남았다. 캡처한 페이지의 문서 가로 오버플로와 JavaScript `pageerror`는 관찰되지 않았다. 운영체제 키보드와 물리 기기의 터치 지연은 별도 검증이 필요하다.

## 실제 API · 390 × 844

최종 Expo Web 빌드에서 실제 FastAPI와 Gemini를 사용했다. 여행 프로필 및 설문 요청 후 첫 대화가 HTTP 502를 반환했다. 재시도한 대화와 이어지는 요청, 조건 제출, 취향 확정, `/api/seoul-find`, 서버 취향 다시 읽기는 HTTP 200으로 완료됐다. 그 전 실행에는 Gemini 중간 응답과 장소 검색에서도 502가 관찰됐다. 성공 한 건으로 공급자 가용성을 추정할 수 없다.

- `after/live/390x844/evidence.json`에 16개 후보와 공급자 집계가 있다. 카카오 13곳, TourAPI 3곳, 이미지 URL이 있는 후보 2곳이었다.
- 서버에서 생성한 대화는 `06-live-question.png`, 확정 키워드와 조건은 `09-confirmed-dna.png`, 추천은 `11-day1.png`부터 `14-day3.png`까지 확인할 수 있다. 상세 복귀 시 Day 3이 선택된 상태였으며 찜은 새로고침 후에도 표시됐다.
- 환기미술관 사진 요청 HTTP 200과 브라우저 디코딩을 확인했다. 이후 같은 URL 요청을 의도적으로 차단해 대체 화면을 확인했다. 해당 1건의 차단은 `imageFailures`에 기록된다. `19-live-tourapi-photo.png`와 `20-live-photo-fallback.png`에 각각 사진 출처 및 차단 결과가 있다.

## 시각적 반복 검토

1. 390 × 844 첫 리뷰에서 패널이 움직이는 중간 프레임을 확인했다. 날짜의 선택 상태를 접근성 속성으로 노출하고, 이미 화면에 들어온 핀의 카메라와 상세 복귀 위치를 유지하도록 수정했다. 인트로 문장 줄바꿈과 대화의 고정 입력란을 조정했다.
2. 375 × 812 fixture와 실제 390 × 844 추천을 나란히 검토했다. 실제의 긴 장소명이 두 줄이 되는 카드 높이, 가까운 웹 핀의 겹침, 그리고 실제 가로 스와이프 후 선택이 바뀌지 않는 웹 이벤트를 수정했다. 세 크기에서 포인터, 터치, 가로·세로 스크롤을 다시 실행했다.
3. 최종 캡처를 비교 이미지와 실제 녹화로 묶었다. `contact-sheet.png`는 같은 fixture의 390 × 844 원본 캡처 6쌍을 배치한 이미지다. `motion-preview.mp4`는 같은 크기의 실제 브라우저 조작을 29.28초 동안 녹화했다. 추천 요청 시 대기 모션, 새 마커와 연결선, 손잡이 드래그가 포함된다.

## 자동 검사

| 명령                                                                                          | 결과                                                                             |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `npm run typecheck`                                                                           | 통과                                                                             |
| `npm test`                                                                                    | 통과 · 29/29. 새 스냅 경계 및 속도 테스트 2개 포함                               |
| `npm run format:check`                                                                        | 통과                                                                             |
| `npx expo-doctor@latest`                                                                      | 19/20. 설치된 Expo 계열 8개와 Safe Area Context 1개의 최신 SDK 58 기대 버전 차이 |
| `npx expo export --platform android --output-dir .codex-temp/presentation-v2-release-android` | 통과 · Hermes 번들 생성                                                          |

설치된 Gesture Handler 3.3.0, Reanimated 4.7.1, Worklets 0.13.0은 설치된 Expo의 `bundledNativeModules.json`에 있는 버전과 일치했다. SDK, 종속 패키지 및 잠금 파일은 기존 버전을 사용했다. 연결된 ADB 기기와 실행 중인 에뮬레이터가 없어 Android 기동, 네이티브 지도 카메라·제스처와 iOS 동작은 검증하지 않았다.

## 실행과 재현

기존 프로젝트 루트에서 `npm run web`을 실행한다. 로컬 FastAPI와 연결하려면 기존 `.venv`와 인증 설정을 사용한다.

```powershell
# backend/travel-preference-mvp
$env:CORS_ALLOW_ORIGINS = 'http://localhost:8091,http://127.0.0.1:8091'
& .venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8778

# 프로젝트 루트에서 다른 터미널
$env:EXPO_PUBLIC_RECOMMENDATION_SERVER_URL = 'http://127.0.0.1:8778'
npm run web -- --port 8091
```

보존 가능한 웹 번들과 같은 사양의 캡처는 아래와 같이 만든다. 도구를 재설치할 필요 없이 기존 Playwright 경로를 `TRAVEL_PLAYWRIGHT`로 지정하거나 Node에서 `playwright`를 확인할 수 있는 환경을 사용한다. Edge를 사용하며 실제 모드에서 스크립트는 요청을 위의 FastAPI 주소로 직접 전달한다.

```powershell
$env:EXPO_OFFLINE = '1'
$env:EXPO_PUBLIC_RECOMMENDATION_SERVER_URL = 'http://127.0.0.1:8778'
npx expo export --platform web --output-dir .codex-temp/presentation-v2-release-web
$env:TRAVEL_EVIDENCE_ROOT = '.codex-temp/presentation-v2-repeat'
$env:TRAVEL_TEST_RETRY = '1'
node presentation/ui-v2/verify.cjs after fixture 390x844 .codex-temp/presentation-v2-release-web
node presentation/ui-v2/verify.cjs after/live live 390x844 .codex-temp/presentation-v2-release-web
```

fixture의 390×844 실행에서 `TRAVEL_RECORD=1`을 지정하면 Edge가 WebM 원본을 남긴다. MP4 변환은 ffmpeg의 H.264 코덱을 사용했다. 비교 이미지는 저장된 기준·최종 캡처로 `python presentation/ui-v2/build-contact-sheet.py`를 실행해 재생성할 수 있다.

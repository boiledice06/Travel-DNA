# Travel DNA 프로젝트 상태

기준: 2026-11-17. 기존 개발 커밋 `98acc4a` 이후 라이브 API 사전 검증 및 실패 처리 보완.

- 목표: 실제 Vertex 대화와 Places·TourAPI를 통해 서울 2박 3일 후보와 지도를 종단 간 검증한다.
- 완료: 실험 `exp-20261117-live-api-preflight-v1`에서 모의 주입 없는 로컬 FastAPI `/docs`, 두 합성 프로필과 설문 단계 확인. 모든 장소 공급자 호출 실패를 빈 성공으로 오인하는 문제를 재현·수정하고 회귀 테스트를 추가했다.
- 관찰: 외부 자격증명이 없는 현재 환경에서 Vertex 대화·키워드 생성 502, Places 독립 검색 503. 상세 근거는 `experiments/exp-20261117-live-api-preflight-v1/http-results.json` 및 `docs/LIVE_API_VERIFICATION.md`.
- 미확정: 실제 모델 접근, 실제 Google/TourAPI 결과, 장소 행정경계·중복, A/B 개인화 품질, 성공 지연시간과 3일 일정 품질. 프런트 사각형 검사는 행정경계를 증명하지 않는다.
- 다음 단계: 사용자가 서버에 적절한 ADC·프로젝트·Places·TourAPI 설정을 완료한 뒤 별도의 새 실험 ID로 최소 호출 A/B를 실행한다. 실패 응답의 시간을 성공 속도로 해석하지 않는다.
- 증거 위치: 로컬 `experiments/exp-20261117-live-api-preflight-v1/`; 원격 아카이브 경로 `Research/Travel-DNA/experiments/exp-20261117-live-api-preflight-v1/` (동기화 검증 여부는 최종 보고 참조).

## 원격 보관 상태

`Research/Travel-DNA/experiments/exp-20261117-live-api-preflight-v1/`에 실험 README, HTTP 결과, 스크립트, 상세 보고 파일 4개를 업로드했다. Drive 메타데이터에서 네 파일의 이름·부모·크기가 로컬과 일치했고 README 및 상세 보고는 텍스트를 재조회해 일치함을 확인했다. 커넥터가 체크섬을 반환하지 않아 JSON·Python 파일의 바이트 단위 일치는 검증하지 못했다. 따라서 전체 동기화의 완전한 무결성 검증은 미완료다. 로컬 파일을 보존한다.

## 2026-11-18 Expo Web 검증 — exp-20261118-expo-web-e2e-v1

실제 서버 추천 15곳의 3일 지도 렌더링 및 날짜 전환을 확인했다. 모바일 긴 마커 라벨과 지도 버튼이 겹치며, AI 대화 캡처와 시작부터 연속 흐름은 미확보다. 따라서 전체 E2E는 미완료. 증거와 재현: `verification/E2E_VERIFICATION_REPORT.md`, `verification/e2e-screenshots/`; 실험 설명: `experiments/exp-20261118-expo-web-e2e-v1/README.md`.

## 2026-11-18 UX 개선 중간 검증

- 실험 ID: `exp-20261118-ux-redesign-v1`. 작업 및 한계: `verification/UX_REDESIGN_REPORT.md`. 이미지 경로와 지도/탭 개선은 진행 중이며 실제 API 브라우저 재검증 및 스크린샷이 남아 있다. Drive 동기화는 미검증이다.

## 2026-11-18 최종 통합 검증

- `exp-20261118-final-integration-v1`: 실제 브라우저 세션에서 Gemini 요청, 카카오 11곳·TourAPI 4곳, 3일 각 5곳과 관광 사진 3곳을 확인했다. 증거: `verification/FINAL_INTEGRATION_REPORT.md`, `verification/final-e2e-screenshots/`.
- 장소 상세 ID, 저장 후 일정 순서, 긴 웹 마커 겹침을 수정했다. 포인터/터치 시트 드래그, 개별 사진 이용 조건, 네이티브 동작 및 전체 콘솔 로그는 미검증이다. 필터 선택 시 일정이 재배치되는 동작은 제품 판단이 필요하다.
- Drive에 ZIP 스냅샷을 업로드하고 부모·크기·다운로드 참조를 확인했다. 체크섬은 미검증이며 ZIP은 보관 상태 추가 전 버전이다. 위치와 한계는 실험 README 참조. 다음 검증은 사진 이용 조건, 시트 제스처, 네이티브 지도 및 필터의 날짜 보존 여부를 우선한다.

## 2026-11-18 최종 잔여 수정

- `exp-20261118-final-polish-v1`: 기존 일정의 날짜·순서를 유지하도록 필터 수정, 실제 저장 추천과 단위 테스트로 확인. 상세 사진 출처·이용 안내와 URL 없는 사진 fallback을 확인했다.
- 시트 포인터 드래그는 재현되지 않았고 자동화 한계와 앱 결함을 구분하지 못했다. 모의 질문 표시는 확인했으나 실제 Gemini 질문 화면과 이미지 요청 실패 fallback은 미검증이다. 증거 및 재현: `verification/FINAL_POLISH_REPORT.md`, `experiments/exp-20261118-final-polish-v1/`.

## 2026-11-25 발표용 UI V2

- 실험 ID `exp-20261125-presentation-ui-v2`. 기준 `a3d604d`, 구현 `9ff7109`, 브랜치 `codex/presentation-ui-v2`.
- 인트로, 여행 조건, 설문·대화, DNA, 추천 지도와 실시간 드래그 패널, 장소·찜·일정 화면을 개편했다.
- 실제 여행 서버와 공급자 호출에서 200 성공 경로와 HTTP 502 실패가 모두 관찰됐다. 화면별 결과, 뷰포트 및 실제·fixture 구분은 [검증 보고서](presentation/ui-v2/VERIFICATION.md)를 참고한다.
- Android 번들은 생성됐다. ADB에 연결된 실행 대상이 없어 네이티브 지도, OS 키보드, 네이티브 제스처 검증은 남아 있다.
- 실험 방법과 증거는 [실험 README](experiments/exp-20261125-presentation-ui-v2/README.md), 보관 위치와 무결성 확인은 [아카이브 기록](experiments/exp-20261125-presentation-ui-v2/ARCHIVE.md)에 기록한다.

## 2026-11-25 백엔드 안정화·사진 보강

- 실험 `exp-20261125-image-enrichment`, 기준 `cffd8d4`, 구현 `7b737db` 및 대화 레이아웃 `65eebc1`.
- Gemini 공급자 오류를 인증·설정·한도·일시 장애·효과가 불분명한 타임아웃·응답 형식으로 구분했다. 제한된 서버 재시도와 중복 요청 제어를 적용했다. 기존 성공 응답 계약과 일정 배정을 사용한다.
- 기존 실제 서울 추천 후보 16곳에서 검증 사진을 0곳에서 8곳으로 늘렸다. 카카오 후보 4곳에는 Wikimedia Commons 사진을 연결했다. 별도의 신규 실제 추천 결과와 성능 수치는 [검증 결과](presentation/image-enrichment/VERIFICATION.md)에 있다.
- 포토코리아는 기존 인증 요청에서 403이 관찰됐다. 공급자 승인 후 실제 응답을 검증할 수 있다. 네이티브 기기 동작, 공급자 장기 가용성과 전체 사진 라이선스 적용 범위 검토는 남아 있다.
- [사진별 판정](presentation/image-enrichment/PHOTO_SOURCES.md) · [실험 README](experiments/exp-20261125-image-enrichment/README.md) · [보관 기록](experiments/exp-20261125-image-enrichment/ARCHIVE.md)

## 2026-11-25 Golden Path 발표

- 실험 `exp-20261125-golden-path`, 기준 `9c0dc1a`, 구현 `ffe0b3f`. [실험 README](experiments/exp-20261125-golden-path/README.md)
- 단일 실제 서울 2박 3일 세션의 후보 16곳과 검증 사진 10장을 고정했다. 기존 일정 로직의 방문 15곳, 확정 키워드, 저장 동작과 입력 불일치 처리를 Expo Web에서 5회 연속 확인했다. [반복 검증](presentation/final/VERIFICATION.md)
- 외부 HTTPS 차단 실행에서 기록과 로컬 사진은 재생됐다. 인터넷이 없는 지도는 로컬 영상으로 대응한다. 예비 영상과 발표 스크린샷은 [발표 패키지](presentation/final/README.md)에 있다.
- Android 번들 빌드는 통과했다. Android·iOS 물리 기기 실행과 장기적인 상류 API 가용성은 미검증이다. 다음 현장 확인 대상은 행사 네트워크에서의 타일 로딩과 실제 발표 장비의 영상 재생이다.
- Drive 경로는 `Research/Travel-DNA/experiments/exp-20261125-golden-path/`이다. [아카이브 기록](experiments/exp-20261125-golden-path/ARCHIVE.md)

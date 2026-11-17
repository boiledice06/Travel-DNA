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

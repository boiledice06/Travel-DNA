# exp-20261118-final-integration-v1

- 목적: 기존 UX 변경 이후 실제 Gemini·Kakao·TourAPI와 Expo Web 전체 흐름 및 관광 사진을 검증한다.
- 가설: 실제 서버 후보와 사진이 세션 전반에 유지되고 세 날짜의 지도와 카드가 동기화된다.
- 방법·조건·관찰·한계: `../../verification/FINAL_INTEGRATION_REPORT.md`. 실제 브라우저 스크린샷: `../../verification/final-e2e-screenshots/`.
- 실행일: 2026-11-18 Asia/Seoul. 시작 Git revision `ca3b39c`와 당시 미커밋 작업 트리. 이후 수정 커밋 `0b438ad`, `d98dd09`. Windows, Expo SDK 및 Python 의존성은 루트 `package-lock.json`과 백엔드 `uv.lock` 참조.
- 데이터: 서울, 2박 3일, 박물관·미술관·산책 선호 및 술집 제외. 실시간 공급자 응답으로 버전 및 난수 시드 적용 불가. 실제 사진 3곳 확인. 사용자 만족도나 이동 시간은 측정하지 않았다.
- `live-api-results.json`과 `live_api_probe.py`는 별도 직접 탐침의 실패 기록이다. 콘솔 인코딩으로 한국어 입력이 손상됐고 Gemini 503으로 중단됐다. 브라우저의 별도 성공 세션과 혼동하지 않는다.
- 보관: `Research/Travel-DNA/experiments/exp-20261118-final-integration-v1/`의 [ZIP](https://drive.google.com/file/d/18VpF5pTuKGBKZ_orLg93TIeU3q7l702O/view). Drive 메타데이터와 다운로드 참조를 재조회해 부모와 크기 702,636바이트가 로컬 ZIP과 일치함을 확인했다. 커넥터가 체크섬을 반환하지 않아 바이트 일치는 미검증이다. ZIP은 이 보관 문단 추가 전 스냅샷이다. 로컬 원본은 유지한다.

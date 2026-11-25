# 발표 API 기록과 사진 바이트

`recording.json`은 2026-11-25(Asia/Seoul) 한 개의 기존 FastAPI 실제 호출 흐름에서 얻은 입력과 응답입니다. 합성용 여행 입력으로 Gemini, Kakao, TourAPI, Wikimedia Commons를 호출했습니다. 동일한 프로필 ID·세션 ID 문자열을 각각 `golden-profile`, `golden-session`으로 치환했습니다. 헤더, API 키, 토큰은 기록하지 않았으며 추천 순서와 응답 본문은 동일 세션에서 가져왔습니다.

`media.json`은 검증된 사진 URL별 파일명, SHA-256, 바이트 수, MIME을 기록합니다. `assets/`에는 응답받은 사진 바이트를 그대로 보관합니다. 사진별 출처, 저작자, 라이선스, 일치 근거는 [사진 기록](../PHOTO_SOURCES.md)을 참고하세요.

이 기록을 재생하는 데 백엔드 인증이 필요하지 않습니다. 다른 시나리오에서는 실제 서비스 환경을 사용합니다. 새로운 실측 기록이 필요하다면 기존 결과와 별개의 경로에서 `scripts/golden-path/record.mjs`를 실행합니다. 실측 입력의 목적은 기존 프런트엔드 API 계약에 따라 필수 조건 문자열의 첫 줄로 전달됩니다.

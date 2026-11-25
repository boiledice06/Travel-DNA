# Travel DNA 사진 보강 실험

- 실험 ID `exp-20261125-image-enrichment`
- 실행일 2026-11-25 Asia/Seoul
- 기준 `cffd8d4` · 구현 `7b737db` · 대화 레이아웃 `65eebc1` · 브랜치 `codex/presentation-ui-v2`

## 목적과 방법

실제 서울 2박 3일 후보 순서를 그대로 유지하면서, 장소를 잘못 연결하거나 라이선스 조건을 추정하지 않고 사진을 보강할 수 있는지 검사했다. 같은 기존 추천의 캡처로 화면을 비교했다. 별도로 최종 Expo Web 앱에서 실제 Gemini 대화와 Kakao·TourAPI 추천을 실행했다. 두 케이스의 결과는 따로 집계했다.

기존 케이스는 이전 실제 TourAPI 통합 실행의 `.codex-temp/tourapi-integration-b977b6ffbe/flow-result.json`에서 공개 장소 정보만 발췌했다. 이 오래된 스냅샷은 대표 이미지 필드를 도입하기 전에 저장됐다. 새로운 실제 추천은 기존 인증을 사용한 FastAPI 응답에서 공개 장소 후보와 사진 검증 결과만 저장했다. 난수 시드는 없으며 실제 공급자 응답과 지연은 재현 시 다를 수 있다.

Windows Edge의 Expo Web 390 × 844에서 원본 컨텍스트별로 확인했다. 시간은 기존 일정의 냉·온 배치 시간을 벽시계로 측정했고, 실제 브라우저에서 추천 응답과 지도 노출, 사진 요청의 시점을 따로 기록했다. 라이선스 판정은 그 시점의 공식 API 메타데이터에 근거한다.

## 증거

- [검증 결과와 재현 방법](../../presentation/image-enrichment/VERIFICATION.md)
- [최종 사진별 증거](../../presentation/image-enrichment/PHOTO_SOURCES.md) · [전후 비교](../../presentation/image-enrichment/before-after.png)
- `preliminary-metrics.json`은 Commons가 제공한 추적 쿼리와 신규 공식 섬네일 호스트를 처리하기 전의 측정이다. `review1-after.json`, `review1-live.json`, `review2-live.json`은 시각 검토와 실제 추천의 반복 실행에 사용했다. 최종 실행에는 개선된 DNA 패널과 사진 오류 대체 화면 테스트를 포함한다.
- 배포 가용성·장시간 부하·네이티브 기기 성능이나 전반적인 사용자 선호는 이 실험에서 측정하지 않았다.
- [Drive 아카이브 확인](ARCHIVE.md)

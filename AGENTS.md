# Travel DNA 개발 규칙

## 프로젝트 구조

- app에는 Expo Router 경로와 레이아웃만 둡니다. 화면은 src/features, 재사용 UI는 src/components에 작성합니다.
- 취향/추천 계산은 React에 의존하지 않는 순수 TypeScript로 유지합니다.
- 영속화는 services/storage를 통합니다. 스키마 변경 시 버전과 마이그레이션을 설계하고 기존 데이터를 보존합니다.
- 전역 타입은 src/types에 추가하고 strict를 유지합니다. any와 무근거 타입 단언을 피합니다.
- 코드는 Prettier로 정리합니다.

## 스타일

- React Native StyleSheet만 사용합니다. NativeWind/Tailwind/웹 CSS 화면을 추가하지 않습니다.
- 공유 토큰은 theme에서 관리합니다. 화면 스타일은 .styles.ts로, 작은 컴포넌트는 자체 StyleSheet로 분리합니다.
- 네이비/청록, 충분한 여백, 둥근 카드, 얇은 아이콘, 절제된 그림자를 유지합니다.
- 44dp 이상의 터치 영역, 접근성 역할/레이블/선택 상태, Android Safe Area와 키보드를 고려합니다.
- 주요 버튼 동작, 빈 화면, 오류 복구를 구현합니다. 패널 드래그는 손잡이에서만 시작합니다.

## 네비게이션과 데이터

- Expo Router를 사용하고 동적 화면에는 ID를 전달합니다. 없는 ID에는 복구 경로를 제공합니다.
- 온보딩 완료 이후 기본 진입은 지도이며 복원 완료 전에 진입을 결정하지 않습니다.
- 상세에서 돌아올 때 지도 선택을 유지합니다.
- 장소를 도시로 필터링한 뒤 지도에 전달합니다.
- 시연 데이터와 실제 리뷰 분석을 구분하고 점수를 예상 일치도 지수로 표시합니다.
- 추천 설명은 계산에 사용된 속성에만 근거합니다. 공식 변경 시 문서와 의미 있는 테스트를 수정합니다.

## 패키지 추가

- 설치된 Expo SDK/Expo Go 호환성을 공식 문서와 bundledNativeModules.json으로 확인합니다.
- 네이티브 패키지는 npx expo install을 사용하고 expo-doctor를 실행합니다.
- 필요성과 피어 의존성을 검토합니다. 기본 Animated를 우선 사용합니다.
- Firebase/Supabase/유료 API/로그인 서버는 현재 범위에 없습니다.
- npm audit fix --force로 핵심 SDK 버전을 임의 변경하지 않습니다.

## 기능별 범위와 팀 통합

- 지도: components/map, features/recommendations의 지도 홈/스타일.
- 기록: features/experiences 및 app/experience.
- 취향: features/travel-dna, services/recommendation 및 테스트.
- 저장: features/saved, services/storage.
- 테마/타입/Context/루트 라우팅/package-lock은 공유 파일입니다. 변경 의도를 팀에 알리고 작은 변경으로 통합합니다.
- 기능별 브랜치와 작은 커밋을 사용하고 다른 기능 파일의 광범위한 포맷 변경을 섞지 않습니다.
- 기존 상위 .source-review 자료를 덮어쓰거나 정리하지 않습니다.

## 제출 전

- npm run typecheck, npm test, npm run format:check, npx expo-doctor@latest.
- 네이티브 코드 경로 변경 시 Android 번들 export를 검사합니다.
- 실행 흐름을 확인하고 브라우저/실기기 검증 결과를 구분합니다. 실기기를 사용하지 않았다면 사용했다고 주장하지 않습니다.

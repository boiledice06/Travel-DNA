# Travel DNA

지난 여행에서 좋아했던 경험과 피하고 싶은 경험을 바탕으로 다음 여행의 장소를 지도에서 발견하는 대학 프로젝트용 React Native MVP.

> **통합 상태:** 제공된 FastAPI를 `backend/travel-preference-mvp/`에 보존하고 2박 3일을 추가했습니다. 서버를 설정하면 지도에서 조건·설문·대화·취향 확정 후 서울 후보를 요청합니다. 외부 AI/장소 서비스에는 서버 측 인증이 필요합니다. [검증 및 제한](docs/IMPLEMENTATION_REPORT.md)을 참고하세요.

## 빠른 실행

현재 의존성: Expo SDK **58**, React Native **0.88.1**, React **19.3.0**, TypeScript strict. 정확한 버전은 package-lock.json을 참고하세요.

```powershell
git clone https://github.com/boiledice06/Travel-DNA.git
cd Travel-DNA
npm ci
npx expo start
```

컴퓨터와 휴대폰을 같은 네트워크에 연결하고 **SDK 58을 지원하는 Expo Go**에서 QR 코드를 엽니다. **데모로 먼저 둘러보기 → 나와 닮은 장소 발견하기**를 누르면 서울 추천 지도로 이동합니다.

다른 네트워크:

```powershell
npx expo start --tunnel
```

Expo CLI가 터널용 패키지 설치를 제안할 수 있습니다. 이번 작업에서는 터널을 실행하지 않았습니다.

브라우저 미리보기:

```powershell
npm run web
```

### Expo Go 버전

설치된 Expo Go가 프로젝트의 SDK 58을 지원하는지 [Expo Go 다운로드 페이지](https://expo.dev/expo-go)에서 확인하세요. Android 기기가 연결된 경우 npx expo start --android도 지원 버전을 안내합니다. iOS 실기기에서는 호환되는 Expo Go 또는 개발 빌드가 필요할 수 있습니다.

- [Expo SDK 공식 문서](https://docs.expo.dev/versions/latest/)
- [react-native-maps의 Expo Go 및 빌드 안내](https://docs.expo.dev/versions/latest/sdk/map-view/)

Expo Go에서는 개발자 지도 API 키 설정이 필요하지 않습니다. 앱 자체의 Android APK에는 Google Maps API 키가 필요합니다.

## 화면 구조

| 경로                              | 역할                                        |
| --------------------------------- | ------------------------------------------- |
| /                                 | 복원 후 온보딩 또는 지도 홈                 |
| /onboarding                       | 브랜드 소개, 직접 시작, 데모                |
| /onboarding/start                 | 닉네임                                      |
| /onboarding/experiences           | 첫 여행 경험 목록                           |
| /experience/new, /experience/[id] | 경험 추가·수정, 만족도 1–5, 태그, 선택 메모 |
| /onboarding/dna                   | 첫 취향 결과와 온보딩 완료                  |
| /(tabs)                           | 지도 홈: 검색, 도시, 필터, 마커, 추천 카드  |
| /(tabs)/saved                     | 북마크 목록                                 |
| /(tabs)/experiences               | 경험 추가·수정·삭제                         |
| /(tabs)/profile                   | 선호 10차원 막대 차트와 기피 특성           |
| /place/[id]                       | 설명, 점수, 근거, 특성, 저장                |

라우트는 화면 모듈을 연결하며 계산·저장 로직을 포함하지 않습니다.

## 지도와 인터랙션

- Android/iOS는 MapCanvas.native.tsx의 **react-native-maps**를 사용합니다.
- 브라우저는 MapCanvas.tsx의 OpenStreetMap 타일을 사용합니다. React Native View/Image/StyleSheet로 구현했으며 웹 CSS UI와 Tailwind를 사용하지 않았습니다. 보이는 타일만 요청하고 오프라인 다운로드하지 않습니다.
- 신규 추천과 지도는 서울로 제한합니다. 기존 부산 저장 기록은 유지합니다.
- 마커 선택, 카드 위치, 지도 중심이 연결됩니다. 가로 카드 스크롤 종료 시 지도가 이동합니다. 상세에서 돌아오면 선택을 유지합니다.
- 데모 필터는 해당 속성 강도 0.5 이상인 장소를 표시하고, 점수는 전체 프로필로 계산합니다. 서버 응답에는 현재 특성 강도가 없으므로 취향 필터 선택 시 서버 장소는 표시되지 않습니다.
- 검색은 현재 도시의 이름·카테고리·동네를 대상으로 합니다. 결과 선택 시 필터를 해제하고 장소를 표시합니다.
- 추천 패널은 Collapsed/Compact/Expanded이며 손잡이 탭·세로 드래그로 전환합니다. 지도/리스트 제스처를 패널이 가로채지 않습니다.
- 현재 위치는 버튼을 누를 때만 요청하며 거부/오류/12초 GPS 지연 안내가 있습니다. 위치를 서버에 저장하지 않습니다.
- 지도 오류 경계/로딩 지연 안내, 이미지 실패 대체 화면, 빈 결과 화면을 제공합니다. 네이티브 SDK 내부의 모든 장애를 JavaScript 경계가 잡을 수 있는 것은 아닙니다.

## 디렉터리

```text
app/                         Expo Router 경로와 레이아웃
src/
  components/common/         버튼·Chip·이미지·공통 스타일
  components/map/            플랫폼별 지도·오류 경계·추천 패널
  components/place/          장소 카드
  components/profile/        DNA 차트
  features/onboarding/       소개·닉네임
  features/experiences/      기록 목록·편집
  features/travel-dna/       취향 계산·분석
  features/recommendations/  지도 홈·상세
  features/saved/            저장 목록
  services/recommendation/   순수 추천 함수·비동기 서비스 계약
  services/storage/          AsyncStorage·스키마 검증
  data/mock/                 장소·지역·데모 경험·라벨
  data/adapters/             외부 장소 배열 검증
  hooks/                     Context 상태
  theme/                     색상·간격·타입·라운드·그림자
  types/                     도메인 타입
  utils/                     위치 타임아웃
tests/                       추천·데이터·저장 형식 검사
docs/                        검증 보고·실기기 체크리스트
```

## 데이터와 출처

Experience: 장소/지역명, 만족도, 좋아한 태그, 기피 태그, 좋았던/아쉬웠던 선택 메모, 수정 시각. 자유 입력한 장소 이름 자체에서 특성을 추정하지 않습니다. 태그와 만족도가 계산에 사용되며 자유 메모는 형태소 분석 없이 2글자 이상의 한글·영문·숫자 연속 문자열을 빈도순으로 최대 10개 추출합니다. 긍정·부정 메모를 분리하며 의미나 의도를 추론하지 않습니다.

Place: ID, 도시/국가/동네, 위경도, 설명, 이미지, 카테고리, 선호/기피 특성 강도(0–1), 키워드, 출처. 좌표는 장소의 대표 지점이며 입구 단위 내비게이션 좌표가 아닙니다. 도시별 범위 및 ID 중복을 테스트합니다.

**특성 강도와 키워드는 편집한 시연 데이터(curated-demo)이며 실제 리뷰 통계가 아닙니다.** reviewKeywords 필드는 향후 연결을 위한 이름이며 현재 값은 편집 키워드입니다. 데모 교토/전주 경험은 가상의 예시입니다.

사진은 Unsplash 여행 분위기 참고 이미지로 실제 해당 장소의 사진이 아닙니다. 상세 화면에 이를 고지합니다. 지도와 사진은 인터넷이 필요합니다. 실제 장소별 사진과 사용 권한을 확보한 로컬 이미지로 교체하는 작업은 남아 있습니다.

## 개인화 추천 공식

calculateDNA와 rankPlaces는 UI와 분리한 순수 함수입니다. 여행자 유형 이름은 표시용이며 계산에 사용하지 않습니다.

1. 만족도 r을 1–5로 제한합니다.
2. 좋아한 태그마다 r / 5를 더합니다. 기록 내 중복 태그는 한 번만 반영합니다.
3. 기피한 태그마다 (6 - r) / 5 + 0.5를 더합니다. 불만족 경험의 기피를 더 강하게 반영합니다.
4. 선호·기피 벡터를 각각 max(1, 벡터 최댓값)으로 나눠 0–1로 정규화합니다.
5. P는 선호 가중치로 계산한 장소 긍정 강도의 가중 평균, C는 기피 가중치로 계산한 위험 강도의 가중 평균입니다. 가중치 합이 0이면 해당 평균은 0입니다.
6. **score = round(clamp(50 + 50 × P - 35 × C, 0, 100))**.
7. 점수 내림차순, 동점은 장소 ID 순으로 정렬합니다.

점수는 **예상 일치도 지수**이며 만족 확률, 실측 정확도 또는 AI 학습 예측이 아닙니다. 취향 정보가 없으면 모두 50점입니다. 기피 태그만 있으면 50점에서 위험에 따라 감점됩니다.

설명은 실제 가중치가 양수이고 장소 강도가 0.4 이상인 선호, 위험 강도가 0.3 이상인 기피만 사용합니다. 속성 기여 순으로 정렬하며 없는 리뷰/경험을 추가하지 않습니다.

예: 맛집만 선호한 프로필의 광장시장은 P=1, C=0 → 100점. 혼잡함도 기피하면 P=1, C=1 → 65점입니다.

## 로컬 저장

AsyncStorage의 @travel-dna/v1에 버전, 닉네임, 온보딩, 데모 여부, 기록, 저장 ID, 도시와 동적 북마크의 장소·추천 근거 스냅샷을 저장합니다. 이전 v1 데이터에는 빈 스냅샷을 적용합니다. 웹 저장소와 네이티브 데이터는 공유되지 않습니다.

읽기는 태그·별점·기록 ID 중복 등을 검증합니다. 복원 실패 시 재시도 화면을 표시하고 기존 데이터를 자동으로 덮어쓰지 않습니다. 쓰기는 순서 큐로 직렬화하며 실패 시 재시도 안내가 있습니다. OS가 저장 직후 강제 종료하면 비동기 쓰기가 끝나지 않을 수 있어 실기기 종료/복원은 별도 검증해야 합니다.

로그인과 클라우드 동기화는 없습니다. 서버 분석에는 여행 조건, 설문 응답, 대화와 필수·제외 조건이 서버로 전송되며 서버의 로컬 파일 저장소에 보관됩니다. 기존 로컬 경험 기록과 점수는 서버 분석에 전송하지 않습니다.

## 추천 서버 연결

제공된 서버의 수정본은 `backend/travel-preference-mvp/`에 있습니다. 이 복사본에서 `category_agent/trip_profile.py`의 기간 타입에 `2n3d`를 추가했습니다. 기존 서버를 따로 운영한다면 동일한 변경을 적용하고 재시작해야 합니다. 기존 `half_day`, `full_day`, `1n2d`는 유지됩니다.

```powershell
cd backend/travel-preference-mvp
Copy-Item .env.example .env
# .env에 서버 측 GOOGLE_PLACES_API_KEY, VERTEXAI_PROJECT 등을 설정하고 ADC 인증을 구성합니다.
# 웹 개발 서버의 정확한 출처를 CORS_ALLOW_ORIGINS에 추가합니다.
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8765
```

로컬 컴퓨터의 브라우저에서 테스트할 때 `.env`의 CORS 예시는 `CORS_ALLOW_ORIGINS=http://localhost:8081,http://127.0.0.1:8081`입니다. 휴대폰은 서버 컴퓨터의 LAN 주소를 사용하고 동일 네트워크에 연결해야 합니다. `0.0.0.0`은 네트워크에 서버를 노출하므로 신뢰할 수 있는 개발망에서만 사용하세요. 서버 키는 앱이나 `EXPO_PUBLIC_*`에 넣지 않습니다.

별도 터미널에서 저장소 루트로 돌아와 공개 서버 주소만 설정하고 Expo를 시작합니다.

```powershell
$env:EXPO_PUBLIC_RECOMMENDATION_SERVER_URL="http://<서버의-LAN-IP>:8765"
npx expo start
```

기존 온보딩을 완료한 뒤 지도 상단의 **여행 조건 입력 · 추천 요청**을 선택합니다. 서버가 설정되지 않은 경우 기존 데모가 동작합니다. 서버 모드에서는 `trip-profile` → `dna-chat/start` → `likert` → `message` → `constraints` → `finalize` → `seoul-find` 순서로 호출합니다. 지도 후보는 서울 좌표와 ID를 검증하고, 서버 점수를 앱 일치도로 변환하지 않습니다. 제공되지 않은 사진이나 근거를 만들지 않습니다. 이전 확정 결과와 프로필/세션 ID는 별도 로컬 저장소에 보존되며, 다시 요청할 때 서버 세션을 확인합니다. 진행 중인 대화는 앱 재시작 후 복원되지 않습니다.

자격증명 없이 통합을 점검할 때는 테스트 전용 모의 서버를 별도 터미널에서 실행합니다. 이 서버의 장소와 AI 응답은 모두 가상 데이터입니다.

```powershell
cd backend/travel-preference-mvp
$env:CORS_ALLOW_ORIGINS="http://localhost:8081,http://127.0.0.1:8081"
uv run uvicorn tests.http_mock_app:app --host 127.0.0.1 --port 18767
# 다른 터미널, 저장소 루트:
node --experimental-strip-types scripts/verify-mock-flow.ts
```

테스트용 서버를 앱에서 이용하려면 Expo를 시작하기 전에 `EXPO_PUBLIC_RECOMMENDATION_SERVER_URL=http://127.0.0.1:18767`을 설정합니다. 실제 기기에서는 기기 자신을 가리키는 `127.0.0.1` 대신 접근 가능한 서버 주소가 필요합니다.

일정은 좌표 근접성에 기반한 세 그룹이며 직선은 실제 이동 경로가 아닙니다. 운영시간·요금·소요시간은 보장하지 않습니다. 서버의 AI 대화 및 장소 검색은 Vertex ADC와 Google Places 키가 설정되어야 실제로 성공합니다. 상세 설정과 제약은 [구현 보고](docs/IMPLEMENTATION_REPORT.md)를 참고하세요.

## Android APK 준비

APK 빌드/배포는 하지 않았습니다. eas.json에는 preview APK 프로필을 준비했습니다.

1. Google Cloud에서 Maps SDK for Android를 활성화합니다.
2. 지도 키를 발급하고 패키지 com.traveldna.mvp 및 빌드 서명 SHA-1으로 제한합니다.
3. EAS 환경 변수 GOOGLE_MAPS_API_KEY를 설정합니다. app.config.ts는 키가 있을 때 react-native-maps config plugin을 추가합니다. 키를 Git에 커밋하지 않습니다.
4. Expo 계정/EAS 프로젝트 연결 및 Android 서명 정보를 설정합니다.
5. 아래 빌드를 실행하고 생성된 APK로 지도, 권한, 시스템 뒤로가기, 종료/복원을 검사합니다.

```powershell
npx eas-cli build --platform android --profile preview
```

최종 브랜드 아이콘/스플래시 이미지, 개인정보 문서, 스토어 메타데이터는 출시 전 추가해야 합니다. [지도 빌드 공식 문서](https://docs.expo.dev/versions/latest/sdk/map-view/)를 참고하세요. Android Studio와 대규모 SDK 다운로드는 진행하지 않았습니다.

## 검증 명령

```powershell
npm run typecheck
npm test
npm run format:check
npx expo install --check
npx expo-doctor@latest
npx expo export --platform android --output-dir dist-android
```

이전 SDK 57 기반 실행 결과는 [검증 보고](docs/VERIFICATION.md), 실기기 확인 항목은 [체크리스트](docs/DEVICE-CHECKLIST.md)에 기록합니다. 과거 결과가 SDK 58의 실기기 실행을 보장하지 않습니다.

## 현재 범위

서울 3일 데모와 서버 취향 분석·후보 추천 흐름을 제공합니다. AI와 장소 서비스의 실제 동작은 서버 인증과 외부 서비스에 의존합니다. 일정은 직선거리 기반 제안이며 실제 경로·영업시간·가격은 검증하지 않습니다. 로그인, 오프라인 지도 및 실제 리뷰 분석은 제공하지 않습니다.

실제 외부 API의 인증 전 검증 결과와 설정 안내는 [라이브 API 검증 보고](docs/LIVE_API_VERIFICATION.md), 현재 연구 상태는 [PROJECT_STATE](PROJECT_STATE.md)를 참고하세요. 실험 ID `exp-20261117-live-api-preflight-v1`의 로컬 증거는 `experiments/`에 있습니다.

Expo Web 모바일 검증 실험 `exp-20261118-expo-web-e2e-v1`: [검증 보고서](verification/E2E_VERIFICATION_REPORT.md), [실험 설명](experiments/exp-20261118-expo-web-e2e-v1/README.md).

UX 개선 중간 검증: `verification/UX_REDESIGN_REPORT.md` (실험 `exp-20261118-ux-redesign-v1`, 미완료).

최종 통합 검증: [보고서](verification/FINAL_INTEGRATION_REPORT.md), [실험 설명](experiments/exp-20261118-final-integration-v1/README.md), `verification/final-e2e-screenshots/`. 실제 API 및 사진 확인과 남은 제약을 구분해 기록합니다.

최종 잔여 수정과 제한: [보고서](verification/FINAL_POLISH_REPORT.md), [실험 설명](experiments/exp-20261118-final-polish-v1/README.md).

## Presentation UI V2

기존 로컬 프로젝트에서 `npm run web`으로 UI V2를 열 수 있습니다. 첫 화면의 **데모로 먼저 둘러보기**는 서버 없이 지도와 로컬 취향을 살펴볼 수 있습니다. 서버 추천 흐름은 기존 FastAPI를 실행하고 `EXPO_PUBLIC_RECOMMENDATION_SERVER_URL`을 설정한 다음 지도에서 **여행 설계**를 누릅니다.

- [디자인 시스템](presentation/ui-v2/DESIGN_SYSTEM.md)과 [화면별 변경 내역](presentation/ui-v2/CHANGELOG.md)
- [실행 검증](presentation/ui-v2/VERIFICATION.md)과 [수정 전후 비교](presentation/ui-v2/contact-sheet.png)
- 실험 `exp-20261125-presentation-ui-v2`의 [재현과 데이터 provenance](experiments/exp-20261125-presentation-ui-v2/README.md)

## 사진 보강과 Gemini 안정화

추천 결과를 지도에 적용한 뒤 사진을 별도로 조회합니다. 라이선스와 동일 장소 판정이 완료된 사진은 지도 추천, 상세, 찜, 일정에 표시합니다. 사진 데이터는 TourAPI와 Wikimedia Commons에서 가져오며, 포토코리아는 별도 서비스 승인이 있으면 사용합니다. [공급원과 설정](presentation/image-enrichment/CHANGES.md)

- [실행 검증과 성능 수치](presentation/image-enrichment/VERIFICATION.md)
- [기존 서울 일정 전후 비교](presentation/image-enrichment/before-after.png) · [사진별 출처·라이선스](presentation/image-enrichment/PHOTO_SOURCES.md)
- [실험 `exp-20261125-image-enrichment`](experiments/exp-20261125-image-enrichment/README.md)

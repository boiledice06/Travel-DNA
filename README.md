# Travel DNA

지난 여행에서 좋아했던 경험과 피하고 싶은 경험을 바탕으로 다음 여행의 장소를 지도에서 발견하는 대학 프로젝트용 React Native MVP.

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
- 서울 8곳, 부산 4곳을 분리합니다. 다른 도시의 마커를 섞지 않습니다.
- 마커 선택, 카드 위치, 지도 중심이 연결됩니다. 가로 카드 스크롤 종료 시 지도가 이동합니다. 상세에서 돌아오면 선택을 유지합니다.
- 필터는 해당 속성 강도 0.5 이상인 장소를 표시하고, 점수는 전체 프로필로 계산합니다.
- 검색은 현재 도시의 이름·카테고리·동네를 대상으로 합니다. 결과 선택 시 필터를 해제하고 장소를 표시합니다.
- 추천 패널은 Compact/Expanded이며 손잡이 탭·세로 드래그로 전환합니다. 지도/리스트 제스처를 패널이 가로채지 않습니다.
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

Experience: 장소/지역명, 만족도, 좋아한 태그, 기피 태그, 좋았던/아쉬웠던 선택 메모, 수정 시각. 자유 입력한 장소 이름 자체에서 특성을 추정하지 않습니다. 태그와 만족도가 계산에 사용되며 자유 메모는 자동 분석하지 않습니다.

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

AsyncStorage의 @travel-dna/v1에 버전, 닉네임, 온보딩, 데모 여부, 기록, 저장 ID, 도시를 저장합니다. 웹 저장소와 네이티브 데이터는 공유되지 않습니다.

읽기는 태그·별점·기록 ID 중복 등을 검증합니다. 복원 실패 시 재시도 화면을 표시하고 기존 데이터를 자동으로 덮어쓰지 않습니다. 쓰기는 순서 큐로 직렬화하며 실패 시 재시도 안내가 있습니다. OS가 저장 직후 강제 종료하면 비동기 쓰기가 끝나지 않을 수 있어 실기기 종료/복원은 별도 검증해야 합니다.

로그인, 클라우드 동기화, 원격 프로필 전송은 없습니다.

## FastAPI / CSV·JSON 연결

RecommendationService의 계약은 recommend(dna, places): Promise&lt;Recommendation[]&gt;입니다. LocalRecommendationService가 이를 구현합니다. 현재 Context는 동기 rankPlaces를 호출하므로 서버 연결 때 서비스 호출·요청 취소·로딩/오류 상태로 바꿉니다.

예상 API는 POST /recommendations, 본문 { dna, places }, 응답 Recommendation[]입니다. 실제 서버와 API 클라이언트는 미구현입니다.

adaptPlaceRows는 JSON 배열 또는 숫자·벡터 컬럼을 변환한 CSV 행 배열을 검증합니다. 원시 CSV 파싱과 업로드 UI는 미구현입니다. 실제 리뷰 분석을 연결할 때 source 타입을 확장하고 출처 표시를 함께 변경한 뒤 데이터 공급 부분을 교체합니다.

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

완료: 온보딩, 닉네임, 경험 CRUD, DNA, 개인화 순위/설명, 지도 탐색, 도시/검색/필터, 두 상태 패널, 상세, 저장/복원, 오류/빈 상태, 화면 전환/터치 피드백.

부분: 외부 어댑터는 변환된 행 검증까지, FastAPI는 계약까지, APK는 설정과 문서까지. 사진은 참고 이미지입니다.

미구현: 로그인/백엔드/AI 학습/실제 리뷰 분석, 일정·날짜·경로 최적화, 다중 사진 갤러리, 오프라인 지도, 마커 클러스터링과 대규모 성능 측정. 60fps를 측정하거나 주장하지 않습니다.

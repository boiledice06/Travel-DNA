# 발표 실행 및 복구

## Windows PowerShell에서 시작

프로젝트 루트에서 두 개의 PowerShell 창을 사용합니다. 기존 Node.js와 설치된 Expo 의존성을 사용합니다.

```powershell
npm run demo
```

서버에 A 사진 5개와 B 사진 10개 확인, 각각 누락 0개가 표시되면 두 번째 창에서 다음을 실행합니다.

```powershell
npm run demo:reset
Invoke-RestMethod http://127.0.0.1:8785/demo-api/a/api/demo/health
Invoke-RestMethod http://127.0.0.1:8785/api/demo/health
```

Edge에서 [발표 시작 주소](http://127.0.0.1:8785/)를 열어 A 또는 B를 선택하고 **발표 모드 · 실제 추천 기록 재생** 표시와 서울 야경을 확인합니다. 열려 있던 탭이면 시작 주소를 다시 열거나 새로고침합니다. 지도 화면에서 OpenStreetMap 타일을 확인하려면 인트로부터 한 번 시연한 뒤 다시 초기화합니다.

발표 서버는 로컬 포트 8785를 사용합니다. 브라우저의 실제 서비스 저장 키와 발표 저장 키는 분리됩니다. A와 B의 추천 일정, 찜, 응답 진행 상태는 따로 저장됩니다. 같은 탭에서 유형을 바꾸려면 시나리오 선택 주소를 다시 엽니다. 초기화는 두 유형에 새 발표 저장 영역을 활성화하고 서버의 진행 상태를 비웁니다. 로컬 사용자 데이터와 `.env`는 그대로 보존됩니다. 기존의 실제 서비스는 기존 실행 방법과 인증 설정으로 사용할 수 있습니다.

## 자동 검증 및 촬영

Edge와 Playwright가 필요합니다. Playwright가 이미 로컬 Node.js에서 해석되면 환경 변수 없이 실행할 수 있습니다. Codex 데스크톱 번들에 있는 기존 Playwright를 사용할 때의 예시입니다.

```powershell
$env:TRAVEL_PLAYWRIGHT = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
npm run demo:capture -- --runs=5
npm run demo:capture -- --scenario=a --offline --no-screenshots
npm run demo:capture -- --scenario=b --offline --no-screenshots
npm run demo:capture -- --film
npm run demo:capture -- --highlights
```

촬영할 때는 동일한 발표 서버를 발표자와 공유하지 않습니다. 자동 검증은 서버의 발표 상태를 초기화합니다. 영상 인코딩에는 시스템에 설치된 FFmpeg가 필요합니다. 평소 발표는 [발표 대본](DEMO_SCRIPT.md)에 따라 손으로 조작합니다.

## 이상이 생기면

| 상황                           | 복구                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 포트 8785를 열 수 없음         | 기존 발표 서버의 `/api/demo/health`를 확인하고 재사용합니다. 서버를 마무리할 때 시작한 터미널에서 Ctrl+C를 사용합니다.                     |
| 발표 모드 시작 오류 또는 오래된 빌드 | 기존 발표 서버를 종료하고 프로젝트 루트에서 `npm run demo`로 웹 빌드를 다시 만든 뒤 루트 주소에서 유형을 선택합니다. 서버 로그와 `/api/demo/health`의 번들 식별자를 확인할 수 있습니다. |
| 직전 발표의 장소나 화면이 보임 | `npm run demo:reset`을 실행한 뒤 시작 주소를 다시 열어 인트로와 발표 표시를 확인합니다.                                                    |
| 발표 입력 불일치 메시지        | [발표 대본](DEMO_SCRIPT.md)의 문장과 쉼표를 그대로 사용합니다. 중간 상태를 잃었으면 초기화하고 시작합니다.                                 |
| 사진 준비 상태 실패            | 체크아웃에 `fixtures/assets`와 `media.json`이 있는지 확인하고 서버를 재시작합니다. 사용할 수 없는 사진에는 카테고리 일러스트가 표시됩니다. |
| 지도 타일이 로드되지 않음      | 발표에는 로컬 MP4를 사용합니다. 지도 타일 서비스는 인터넷을 사용합니다. 로컬 API 녹화와 장소 사진은 계속 동작합니다.                       |

지도는 OpenStreetMap의 표준 타일을 화면에 필요한 범위에서 표시합니다. [타일 사용 정책](https://operations.osmfoundation.org/policies/tiles/) · [지도 출처](https://www.openstreetmap.org/copyright)

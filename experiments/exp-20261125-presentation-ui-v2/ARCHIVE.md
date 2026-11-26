# Travel DNA UI V2 아카이브 검증

실험 `exp-20261125-presentation-ui-v2` · 2026-11-25 Asia/Seoul

- Drive 경로 `Research/Travel-DNA/experiments/exp-20261125-presentation-ui-v2/`
- [최종 검증 아카이브 v2](https://drive.google.com/file/d/1TVpkFgTYiBZYNRXMz_AudgNShtKwrgQK/view?usp=drivesdk)
- 로컬 `verification/exp-20261125-presentation-ui-v2-v2.zip`
- 파일 114개, 원본 실행 스크린샷 96장, ZIP 16,134,324바이트
- SHA-256 `eca3eb2834175b5f74930036b505e81d6813595b45d531769642e08bebdbef4a`

업로드 후 Drive에서 파일명, 상위 폴더와 크기를 확인했다. 커넥터에서 ZIP을 다시 읽어 계산한 SHA-256이 로컬 ZIP과 일치했다. ZIP에는 검증 자료와 실험 README가 있다. 이 보관 확인서는 로컬 실험 폴더에 별도로 둔다. [검증된 v1](https://drive.google.com/file/d/1KC429IY8nKeCOzHXvy8z0hKv00ilt9qz/view?usp=drivesdk)은 문서 공백을 정리하기 전 스냅샷으로 보존한다.

## 로컬 정리 제안

| 분류             | 경로                                                                                                                                                             | 용량                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| KEEP             | `src/`, `backend/`, `presentation/ui-v2/`, `experiments/`, 기존 검증 자료 및 가상환경                                                                            | 활성 작업·재현 자료         |
| KEEP             | `.codex-temp/presentation-v2-before/`, `.codex-temp/presentation-v2-video/`, `.codex-temp/presentation-v2-checks/`                                               | 기준 번들 및 녹화·검토 원본 |
| ARCHIVE          | `verification/exp-20261125-presentation-ui-v2-v1.zip`                                                                                                            | 15.4 MiB                    |
| DELETE_CANDIDATE | `.codex-temp/presentation-v2-pass1/`, `.codex-temp/presentation-v2-pass2/`, `.codex-temp/presentation-v2-final-web/`, `.codex-temp/presentation-v2-release-web/` | 약 28.0 MiB                 |
| DELETE_CANDIDATE | `.codex-temp/presentation-v2-android/`, `.codex-temp/presentation-v2-release-android/`                                                                           | 약 17.3 MiB                 |

정리 후보는 다시 export할 수 있는 이번 작업의 빌드 산출물이며 전체 약 45.2 MiB다. 사용자 승인 전까지 로컬 파일을 보존한다.

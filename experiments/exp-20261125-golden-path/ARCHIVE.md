# Golden Path 아카이브 검증

2026-11-25 Asia/Seoul에 Google Drive의 기존 `Research/Travel-DNA/experiments/` 아래 `exp-20261125-golden-path/`에 보관했습니다. ZIP 세 개를 합하면 `presentation/final/`의 파일 52개를 정확히 한 번씩 포함합니다. 로컬 ZIP 무결성 검사와 파일별 바이트 대조를 통과했습니다. Drive에서 이름, 상위 폴더, 크기를 확인하고 인증된 다운로드의 SHA-256을 로컬 ZIP과 직접 비교했습니다. 모두 일치했습니다. [Drive 보관 폴더](https://drive.google.com/drive/folders/19t_3KvAVog5Z_KW7gnfQXAJjO7oHU2NE)

| 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| [화면 19장 및 Contact Sheet](https://drive.google.com/file/d/1hofhA1DPFPcNuZAKq3aUXKU00Gt15q5y/view?usp=drivesdk) | 17,808,141 | `f45a84ab4dab1d0adcb405a7b3268ba18f2defea48ce11b3b9bd458a46729444` |
| [API 기록, 사진, 문서, 검증 증거](https://drive.google.com/file/d/1cNEzKyqf62t8Ei4bINYvHpbS_Blw39vo/view?usp=drivesdk) | 3,909,782 | `0621c5e3ce114701399a5acb62233df88838af1b2007589edd5630a67761f7cc` |
| [전체·요약 영상](https://drive.google.com/file/d/1qbdrYkUE4eLc7sTVlnHhVIswQhUxgcIh/view?usp=drivesdk) | 17,871,356 | `4f594d7930d4a301ae6705c9d17528245a9c2c27bd84bfd69ed8bda93933fab5` |

로컬 ZIP은 프로젝트의 `verification/`에 같은 버전 이름으로 있습니다. 발표 원본은 `presentation/final/`에 있습니다.

## 보존 및 정리 후보

- **KEEP** 소스, 발표 원본, 원본 WebM, 별도 실제 모드 실행 증거, 기존 실험 전체와 행사 준비용 웹 빌드 `.codex-temp/golden-path/web/`.
- **ARCHIVE** Drive에서 다운로드와 체크섬 검증을 마친 위 ZIP 3개.
- **DELETE_CANDIDATE** 재생성 가능한 `.codex-temp/golden-path/android/`, `.codex-temp/golden-path/live-web/`, `.codex-temp/golden-path/full-demo-padded.mp4`, `.codex-temp/golden-path/highlights-padded.mp4`. 합계 27,643,235바이트(약 26.4MiB)입니다. 파일은 보존되어 있습니다.

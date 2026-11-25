# 서울 장소 실제 사진 확보

2026-11-25 Asia/Seoul · 시작 코드 fc2b9d9. 기존 장소 ID와 A/B 기록을 기준으로 40개 화면 표시 대상에서 중복을 합쳐 고유 장소 30곳을 확인했습니다. 사진은 고유 장소 25곳에 연결했습니다.

| 유형 | 확보 및 카드·상세 렌더링 | 미확보 |
| --- | ---: | --- |
| 기본 서울 데모 | 8/8 | 없음 |
| A. 활기찬 체험형 | 12/16 | 콤포타블 남산, 러시아케이크, 테라로사 포스코센터점, 동작노을카페 |
| B. 조용한 휴식형 | 15/16 | 김세중미술관 |

Edge에서 40개 카드와 상세를 모두 열었습니다. 사진이 있는 경우 두 화면에서 같은 로컬 파일의 이미지 디코딩과 브라우저 표시를 확인했습니다. 다른 출처의 이미지 요청을 차단했으며, 지도 타일은 별도로 연결했습니다. A/B의 기존 15곳 일정은 그대로이며 일정에 배정되지 않은 16번째 후보는 전체 확장 목록에서 볼 수 있습니다. 사진 미확보 장소도 해당 목록과 상세에 남아 있습니다.

[기본 데모](demo-contact-sheet.png) · [A 지도와 전체 카드](a-contact-sheet.png) · [B 지도와 전체 카드](b-contact-sheet.png) · [브라우저별 확인 기록](browser-audit.json)

## 개별 사진 미확보

| 장소 | 확인한 검색어·출처 | 결과 |
| --- | --- | --- |
| 동작노을카페 | 동작노을카페, 노을카페, Dongjak Noeul Cafe · 서울관광아카이브, TourAPI 2763751, Commons, 내 손안에 서울 | 아카이브 ARP005lg1은 같은 장소의 사진이며, 개별 페이지에는 공공누리 제2유형(비상업)으로 표시됩니다. TourAPI 상세 이미지가 비어 있고, 서울시 소통포털 사진에는 상업적 재배포를 허용하는 표시를 확인하지 못했습니다. [개별 파일 페이지](https://archive.visitseoul.net/ko/contents/ARP005lg1) · [서울시 소개](https://mediahub.seoul.go.kr/archives/2012830) |
| 러시아케이크 | 러시아케이크, 러시아 케이크, 러시아케익, Russian Cake Seoul · TourAPI, Commons, 서울관광아카이브, 업체 사진과 방문기 | 을지로42길 7 매장의 사진은 찾았으나 공개 재배포 허가를 확인하지 못했습니다. [매장 사진 근거](https://timeplace.co.kr/single_sbook.php?re_idx=3847) |
| 콤포타블 남산 | 콤포타블 남산, 콤포타블남산, Comfortabel Namsan, Komfortabel Namsan · TourAPI, Commons, 서울관광아카이브, 그랑핸드, 코시스 | 운영 브랜드와 시공사에 해당 지점 사진은 있으나 공개 재배포 허가를 확인하지 못했습니다. [브랜드 자료](https://granhand.com/article/journal/8/138/) · [시공사 자료](https://icosis.net/article/project-gallery/8/215/) |
| 테라로사 포스코센터점 | 테라로사 포스코센터점, 테라로사 포스코센터, Terarosa POSCO Center · TourAPI, Commons, 서울관광아카이브, 테라로사, 포스코 O&M | 공식 지점 페이지와 시설 자료의 사진은 장소가 일치하지만 공개 재배포 허가를 확인하지 못했습니다. [브랜드 매장](https://and.terarosa.com/store/6/detail) |
| 김세중미술관 | 김세중미술관, Kim Sechoong Museum, Kim Se Chung Museum · TourAPI 3080721, 서울 문화공간, 서울관광아카이브, Commons | TourAPI 상세 이미지가 비어 있고 다른 출처에서 장소 일치와 재배포 조건을 모두 확인한 사진이 없었습니다. [서울문화포털](https://culture.seoul.go.kr/culture/culture/cultureSpace/view.do?facCode=101119&menuNo=200119) |

## 사진별 출처와 라이선스

| 장소 | 제공처·저작자 | 라이선스 | 일치 근거·처리 |
| --- | --- | --- | --- |
| KCDF 갤러리숍 공예정원 | 한국공예·디자인문화진흥원 · [원본 출처](https://www.kcdf.or.kr/brd/board/324/L/menu/293?bbIdx=427&brdType=R) | [KOGL-1](https://www.kogl.or.kr/info/license.do) | 공진원 보도자료의 인사동 KCDF갤러리 1층 매장과 간판 일치 · 보도자료 첨부 참고사진과 공공누리 제1유형 표시 · 공식 첨부 참고사진.zip의 갤러리숍 (1), 구도를 유지한 축소 JPEG |
| N서울타워 | 서울관광재단 서울관광아카이브 · [원본 출처](https://archive.visitseoul.net/ko/contents/ARP0083q1) | [KOGL-1](https://www.kogl.or.kr/info/license.do) | 서울관광아카이브 ARP0083q1 · 자료명 N서울타워와 소재지 용산 · 남산 일치 · 개별 파일 페이지 공공누리 제1유형 |
| [K드라마 촬영지] 공근혜갤러리 | 한국관광공사 TourAPI · [원본 출처](https://www.data.go.kr/data/15101578/openapi.do) | [KOGL-1](https://www.kogl.or.kr/info/license.do) | TourAPI contentId 3106658 · exact place title; distance 0 m · road address exact · rights code on same response row as firstimage |
| [북악하늘길 2산책로] 하늘교~성북천발원지 | 한국관광공사 TourAPI · [원본 출처](https://www.data.go.kr/data/15101578/openapi.do) | [KOGL-3](https://www.kogl.or.kr/info/license.do) | TourAPI contentId 1037020 · exact place title; distance 0 m · road address exact · rights code on same response row as firstimage · 원본 변경 금지 |
| 경동시장 | Wikimedia Commons · Gaël Chardon · [원본 출처](https://commons.wikimedia.org/wiki/File:Korea-Seoul-Gyeongdong_Market-01.jpg) | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) | 파일 설명의 동대문구 제기동 경동시장 일치 · 공급원 미리보기 사용, 구도 변경 없음 |
| 경복궁 | Wikimedia Commons · Tristan Surtel · [원본 출처](https://commons.wikimedia.org/wiki/File:Heungnyemun.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 파일 설명과 촬영 위치가 경복궁 흥례문과 일치 · 공급원 미리보기 사용, 구도 변경 없음 |
| 광장시장 | Wikimedia Commons · Bgag · [원본 출처](https://commons.wikimedia.org/wiki/File:Gwangjang_Market,_Seoul_02.jpg) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 파일 설명 및 Commons 광장시장 분류 일치 · 공급원 미리보기 사용, 구도 변경 없음 |
| 국립중앙박물관 | Wikimedia Commons · Jinah78 · [원본 출처](https://commons.wikimedia.org/wiki/File:Front_view_of_national_museum_of_korea.jpg) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | Wikidata Q494407: exact Korean or English label/alias · P625 distance 9 m · P18 linked file, identity corroborated by Commons title/description |
| 국립중앙박물관 전통염료식물원 | 한국관광공사 TourAPI · [원본 출처](https://www.data.go.kr/data/15101578/openapi.do) | [KOGL-1](https://www.kogl.or.kr/info/license.do) | TourAPI contentId 1604580 · exact place title; distance 0 m · road address exact · rights code on same response row as firstimage |
| 국립현대미술관 덕수궁 | Wikimedia Commons · Otraff · [원본 출처](https://commons.wikimedia.org/wiki/File:National_Museum_of_Art_Deoksugung-20040302.JPG) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | 파일 설명의 덕수궁 미술관과 1998년 개관 건물의 설계자 명시 · 공급원 미리보기 사용, 구도 변경 없음 |
| 국립현대미술관 서울 | Wikimedia Commons · 서울연구원 · [원본 출처](https://commons.wikimedia.org/wiki/File:MMCA_Seoul.jpg) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 파일 설명과 기관 제공 제목이 서울관 정면으로 명시 · 공급원 미리보기 사용, 구도 변경 없음 |
| 남대문시장 | Wikimedia Commons · d'n'c · [원본 출처](https://commons.wikimedia.org/wiki/File:Seoul-Namdaemun.Market-01.jpg) | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) | 파일 설명의 남대문시장과 귀속 분류 일치 · 공급원 미리보기 사용, 구도 변경 없음 |
| 대한민국역사박물관 | Wikimedia Commons · National Museum of Korean Contemporary History · [원본 출처](https://commons.wikimedia.org/wiki/File:National_Museum_of_Korean_Contemporary_History.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Wikidata Q12592360: exact Korean or English label/alias · P625 distance 28 m · P18 linked file, identity corroborated by Commons title/description |
| 동작구름카페 | 한국관광공사 TourAPI · [원본 출처](https://www.data.go.kr/data/15101578/openapi.do) | [KOGL-3](https://www.kogl.or.kr/info/license.do) | TourAPI contentId 2784696 · exact place title; distance 0 m · road address exact · rights code on same response row as firstimage · 원본 변경 금지 |
| 리움미술관 | Wikimedia Commons · takato marui · [원본 출처](https://commons.wikimedia.org/wiki/File:Leeum,_Samsung_Museum_of_Art.jpg) | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) | Wikidata Q487498: exact Korean or English label/alias · P625 distance 52 m · P18 linked file, identity corroborated by Commons title/description |
| 북촌한옥마을 | Wikimedia Commons · Tristan Surtel · [원본 출처](https://commons.wikimedia.org/wiki/File:Bukchon-ro_11-gil_02.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 파일 설명의 북촌로11길 골목과 촬영 좌표가 북촌한옥마을과 일치 · 공급원 미리보기 사용, 구도 변경 없음 |
| 서울숲 | Wikimedia Commons · Enigma7seven · [원본 출처](https://commons.wikimedia.org/wiki/File:Seoulforest_path01.jpg) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | Commons 서울숲 분류와 파일 설명의 공원 내부 산책로 일치 · 공급원 미리보기 사용, 구도 변경 없음 |
| 서울시립미술관 서소문본관 | Wikimedia Commons · Tksgk262 · [원본 출처](https://commons.wikimedia.org/wiki/File:Seoul_Museum_of_Art_(%EC%84%9C%EC%9A%B8%EC%8B%9C%EB%A6%BD%EB%AF%B8%EC%88%A0%EA%B4%80).jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Commons 서소문본관 분류와 본관 외관 일치 · 공급원 미리보기 사용, 구도 변경 없음 |
| 서울역사박물관 | Wikimedia Commons · Jjw · [원본 출처](https://commons.wikimedia.org/wiki/File:Seoul_Museum_of_History.JPG) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | Wikidata Q484862: exact Korean or English label/alias · P625 distance 10 m · P18 linked file, identity corroborated by Commons title/description |
| 서촌 | 한국관광공사 TourAPI · [원본 출처](https://www.data.go.kr/data/15101578/openapi.do) | [KOGL-1](https://www.kogl.or.kr/info/license.do) | TourAPI contentId 2037020 · 경복궁 서쪽 서촌마을의 관광공사 공식 장소 사진 · 동일 응답 이미지 이용 코드 Type1 |
| 응봉체육공원 | 한국관광공사 TourAPI · [원본 출처](https://www.data.go.kr/data/15101578/openapi.do) | [KOGL-3](https://www.kogl.or.kr/info/license.do) | TourAPI contentId 2757822 · exact place title; distance 0 m · provider object coordinates · rights code on same response row as firstimage · 원본 변경 금지 |
| 청계천 | Wikimedia Commons · Sharon Hahn Darlin · [원본 출처](https://commons.wikimedia.org/wiki/File:%EC%B2%AD%EA%B3%84%EC%B2%9C_Cheonggyecheon,_Seoul,_South_Korea.jpg) | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) | 파일 설명의 서울 청계천 산책 구간 일치 · 공급원 미리보기 사용, 구도 변경 없음 |
| 퐁피두센터 한화 | 한국관광공사 TourAPI · [원본 출처](https://www.data.go.kr/data/15101578/openapi.do) | [KOGL-1](https://www.kogl.or.kr/info/license.do) | TourAPI contentId 4091192 · 여의도 63로 50 퐁피두센터 한화 전용 외부 사진 · 동일 응답 이미지 이용 코드 Type1 |
| 한강시민공원 뚝섬수영장(실외) | 한국관광공사 TourAPI · [원본 출처](https://www.data.go.kr/data/15101578/openapi.do) | [KOGL-3](https://www.kogl.or.kr/info/license.do) | TourAPI contentId 775883 · exact place title; distance 0 m · provider object coordinates · rights code on same response row as firstimage · 원본 변경 금지 |
| 환기미술관 | 한국관광공사 TourAPI · [원본 출처](https://www.data.go.kr/data/15101578/openapi.do) | [KOGL-3](https://www.kogl.or.kr/info/license.do) | TourAPI contentId 129760 · exact place title; distance 0 m · road address exact · rights code on same response row as firstimage · 원본 변경 금지 |

같은 장소는 기존 및 신규 파일을 한 개씩 재사용합니다. 공공누리 제3유형은 원본 바이트와 종횡비를 유지하고, 축소본을 쓴 경우 표에 표시합니다. 서울 추천 이미지에 그 외 다른 장소 사진은 사용하지 않았습니다. 지도 데이터는 OpenStreetMap 기여자에게 귀속됩니다.

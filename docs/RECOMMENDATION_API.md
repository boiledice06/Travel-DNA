# 추천 API 제안 계약

이 문서는 프런트엔드 연결을 위한 **제안**이며 팀의 백엔드 구현이나 실제 장소 검증이 완료되었다는 뜻이 아닙니다. 서버 제공자별 LLM·장소 검색 계약은 서버가 담당합니다. 앱은 외부 API 키를 보관하지 않습니다.

## 전송

`EXPO_PUBLIC_RECOMMENDATION_SERVER_URL`은 공개된 서버 기본 URL입니다 (예: `https://example.org/api`). 앱은 `POST <기본 URL>/recommendations`에 JSON을 보냅니다. URL이 없으면 로컬 데모를 사용합니다. 설정이 잘못되었거나 서버가 실패하면 오류를 표시하며 자동으로 데모로 바꾸지 않습니다. 제한 시간은 12초입니다. 운영 환경에서는 HTTPS와 서버 측 인증·남용 방지, 개인정보 처리 방침을 팀에서 결정해야 합니다.

```json
{
  "preferences": {
    "nature": 0,
    "night": 0,
    "walk": 0,
    "architecture": 0,
    "culture": 0,
    "food": 0,
    "quiet": 0,
    "local": 0,
    "shopping": 0,
    "activity": 0
  },
  "aversions": { "crowds": 0, "cost": 0, "waiting": 0, "access": 0, "commercial": 0 },
  "keywords": { "positive": ["바다"], "negative": ["대기"] },
  "conditions": {
    "region": "seoul",
    "budget": "5만원",
    "availableTime": "3시간",
    "companions": "친구",
    "purpose": "산책"
  }
}
```

벡터는 각 키가 모두 존재하는 0–1 숫자입니다. `region`은 현재 `seoul` 또는 `busan`; 나머지 조건은 생략 가능한 자유 텍스트입니다. 키워드는 경험 메모에서 추출한 제한적 문자열이며 형태소 분석 결과가 아닙니다. 개인정보가 포함될 수 있습니다. 원본 메모와 경험 ID는 전송하지 않습니다.

## 응답

성공 시 HTTP 2xx와 다음 JSON을 반환합니다. 빈 배열은 정상적인 빈 결과입니다.

```json
{
  "places": [
    {
      "id": "provider-place-id",
      "name": "장소명",
      "latitude": 37.5,
      "longitude": 127.0,
      "region": "seoul",
      "category": "문화",
      "reason": "추천 근거",
      "source": "장소 데이터 제공자",
      "country": "대한민국",
      "district": "동네",
      "description": "설명"
    }
  ]
}
```

`id`, `name`, `region`, `category`, `reason`, `source`는 비어 있지 않은 문자열, 좌표는 유한한 위도 -90~90·경도 -180~180이어야 합니다. `country`, `district`, `description`은 선택 문자열입니다. 응답 지역은 요청 지역과 같아야 하며 출처와 ID 조합은 응답 내에서 유일해야 합니다. 항목 하나라도 유효하지 않으면 응답 전체를 거부합니다. 앱은 출처와 외부 ID로 내부 ID를 구성하고 서버 근거를 그대로 표시하며 점수를 만들어내지 않습니다. 사진과 특성 점수는 현재 계약에 없습니다.

프런트엔드의 형식 검증은 장소가 실제 존재하는지 보증하지 않습니다. 서버가 후보를 실제 검색 결과와 대조하고 신뢰할 수 있는 ID·좌표·출처를 반환해야 합니다. 제공자의 ID 안정성, 최신성, 추천 근거의 검증 및 이용 권한은 팀 협의가 필요합니다.

북마크는 확인된 응답의 스냅샷을 기기에 저장하며 최신 정보로 자동 갱신하지 않습니다. 네트워크 오류, 비정상 HTTP, JSON 또는 스키마 오류, 시간 초과는 오류로 표시합니다. API 스키마, 인증, 개인 정보 보관 기간, 삭제 정책 및 조건의 단위는 백엔드와 확정해야 합니다.

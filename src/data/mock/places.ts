import type { Attribute, Conflict, Experience, Place, RegionId } from '../../types/index.ts';
export const attributeLabels: Record<Attribute, string> = {
  nature: '자연 / 풍경',
  night: '야경',
  walk: '골목 산책',
  architecture: '건축',
  culture: '역사 / 문화',
  food: '맛집',
  quiet: '조용한 분위기',
  local: '현지 경험',
  shopping: '쇼핑',
  activity: '액티비티',
};
export const conflictLabels: Record<Conflict, string> = {
  crowds: '혼잡함',
  cost: '높은 비용',
  waiting: '긴 대기 시간',
  access: '접근성',
  commercial: '과도한 상업화',
};
export const regions: Record<
  RegionId,
  {
    name: string;
    english: string;
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }
> = {
  seoul: {
    name: '서울',
    english: 'SEOUL, SOUTH KOREA',
    latitude: 37.5665,
    longitude: 126.982,
    latitudeDelta: 0.09,
    longitudeDelta: 0.09,
  },
  busan: {
    name: '부산',
    english: 'BUSAN, SOUTH KOREA',
    latitude: 35.159,
    longitude: 129.112,
    latitudeDelta: 0.19,
    longitudeDelta: 0.23,
  },
};
const photo = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1000&q=80`;
const city = photo('photo-1535189043414-47a3c49a0bed');
const green = photo('photo-1441974231531-c6227db76b6e');
const sea = photo('photo-1476514525535-07fb3b4ae5f1');
// These intensities are editorial demo assumptions, not measured reviews.
export const places: Place[] = [
  {
    id: 'seochon',
    name: '서촌',
    region: 'seoul',
    district: '종로구 · 경복궁 서쪽',
    latitude: 37.5795,
    longitude: 126.9699,
    category: '골목 산책',
    image: city,
    description:
      '낮은 집과 작은 가게가 이어지는 경복궁 서쪽 동네. 큰길에서 한 걸음 벗어나 골목의 속도로 걸어보세요.',
    positiveAttributes: {
      walk: 1,
      architecture: 0.85,
      culture: 0.65,
      local: 0.9,
      quiet: 0.65,
      food: 0.6,
    },
    negativeAttributes: { crowds: 0.35, commercial: 0.3 },
    reviewKeywords: ['한옥 골목', '동네 산책', '작은 가게'],
  },
  {
    id: 'gyeongbokgung',
    name: '경복궁',
    region: 'seoul',
    district: '종로구 · 사직로',
    latitude: 37.5796,
    longitude: 126.977,
    category: '역사 / 문화',
    image: city,
    description:
      '조선 왕조의 중심 궁궐. 넓은 마당과 전각 사이에서 전통 건축의 비례와 오래된 풍경을 살펴볼 수 있습니다.',
    positiveAttributes: { architecture: 1, culture: 1, walk: 0.6, nature: 0.45 },
    negativeAttributes: { crowds: 0.75, cost: 0.2, waiting: 0.2 },
    reviewKeywords: ['궁궐', '전통 건축', '역사'],
  },
  {
    id: 'bukchon',
    name: '북촌한옥마을',
    region: 'seoul',
    district: '종로구 · 북촌로',
    latitude: 37.5826,
    longitude: 126.9831,
    category: '건축',
    image: city,
    description:
      '한옥 지붕이 이어지는 언덕과 골목. 주민이 생활하는 동네이므로 조용히 걷고 현장 방문 시간 안내를 확인해 주세요.',
    positiveAttributes: { architecture: 1, walk: 0.9, culture: 0.8, local: 0.6 },
    negativeAttributes: { crowds: 0.85, access: 0.45, commercial: 0.4 },
    reviewKeywords: ['한옥', '언덕', '골목'],
  },
  {
    id: 'namsan',
    name: 'N서울타워',
    region: 'seoul',
    district: '용산구 · 남산',
    latitude: 37.5512,
    longitude: 126.9882,
    category: '야경',
    image: city,
    description:
      '남산 위에서 바라보는 서울의 스카이라인. 산책로와 전망대에서 서로 다른 높이의 도시 풍경을 즐길 수 있습니다.',
    positiveAttributes: { night: 1, nature: 0.7, walk: 0.65, activity: 0.5 },
    negativeAttributes: { crowds: 0.8, cost: 0.8, waiting: 0.7, access: 0.5 },
    reviewKeywords: ['전망', '도시 야경', '남산'],
  },
  {
    id: 'museum',
    name: '국립중앙박물관',
    region: 'seoul',
    district: '용산구 · 서빙고로',
    latitude: 37.5239,
    longitude: 126.9805,
    category: '역사 / 문화',
    image: city,
    description:
      '시대와 문화가 만나는 전시 공간. 전시실에서 천천히 머문 뒤 정원과 거울못을 함께 둘러보기 좋습니다.',
    positiveAttributes: { culture: 1, architecture: 0.7, quiet: 0.8, nature: 0.45, walk: 0.4 },
    negativeAttributes: { crowds: 0.3, access: 0.25 },
    reviewKeywords: ['전시', '정원', '문화'],
  },
  {
    id: 'market',
    name: '광장시장',
    region: 'seoul',
    district: '종로구 · 창경궁로',
    latitude: 37.5701,
    longitude: 126.9997,
    category: '맛집',
    image: city,
    description:
      '음식과 상점이 밀집한 서울의 전통시장. 활기찬 시장 풍경 속에서 여러 음식을 조금씩 경험할 수 있습니다.',
    positiveAttributes: { food: 1, local: 1, shopping: 0.7, culture: 0.4 },
    negativeAttributes: { crowds: 1, waiting: 0.65, commercial: 0.65 },
    reviewKeywords: ['시장 음식', '현지 경험', '활기'],
  },
  {
    id: 'stream',
    name: '청계천',
    region: 'seoul',
    district: '중구 · 청계천로',
    latitude: 37.5691,
    longitude: 126.9787,
    category: '골목 산책',
    image: green,
    description:
      '도시 한가운데 흐르는 물길을 따라 걷는 산책. 해가 진 뒤에는 낮과 다른 도심의 분위기를 만날 수 있습니다.',
    positiveAttributes: { walk: 0.95, nature: 0.7, night: 0.75, quiet: 0.55 },
    negativeAttributes: { crowds: 0.4, access: 0.2 },
    reviewKeywords: ['물길', '도심 산책', '저녁 풍경'],
  },
  {
    id: 'forest',
    name: '서울숲',
    region: 'seoul',
    district: '성동구 · 뚝섬로',
    latitude: 37.5445,
    longitude: 127.0374,
    category: '자연 / 풍경',
    image: green,
    description:
      '나무 그늘과 넓은 잔디가 있는 도심 공원. 정해진 목적지 없이 걷거나 잠시 쉬어가기 좋은 장소입니다.',
    positiveAttributes: { nature: 1, quiet: 0.85, walk: 0.9, activity: 0.45 },
    negativeAttributes: { crowds: 0.4 },
    reviewKeywords: ['공원', '나무 그늘', '휴식'],
  },
  {
    id: 'haeundae',
    name: '해운대해수욕장',
    region: 'busan',
    district: '해운대구 · 해운대해변로',
    latitude: 35.1587,
    longitude: 129.1604,
    category: '자연 / 풍경',
    image: sea,
    description:
      '넓은 모래사장과 바다를 따라 걷는 부산의 해변. 계절과 시간대에 따라 다른 풍경을 보여줍니다.',
    positiveAttributes: { nature: 1, walk: 0.8, activity: 0.8, night: 0.5 },
    negativeAttributes: { crowds: 0.9, commercial: 0.7 },
    reviewKeywords: ['바다', '모래사장', '해변 산책'],
  },
  {
    id: 'gamcheon',
    name: '감천문화마을',
    region: 'busan',
    district: '사하구 · 감내2로',
    latitude: 35.0975,
    longitude: 129.0106,
    category: '골목 산책',
    image: city,
    description:
      '언덕을 따라 이어진 집과 골목이 만들어낸 마을 풍경. 주민의 생활 공간을 존중하며 천천히 둘러보세요.',
    positiveAttributes: { architecture: 0.8, walk: 0.9, culture: 0.7, local: 0.7 },
    negativeAttributes: { crowds: 0.7, access: 0.9, commercial: 0.5 },
    reviewKeywords: ['언덕 마을', '골목', '색채'],
  },
  {
    id: 'gwangalli',
    name: '광안리해수욕장',
    region: 'busan',
    district: '수영구 · 광안해변로',
    latitude: 35.1532,
    longitude: 129.1186,
    category: '야경',
    image: sea,
    description:
      '광안대교를 마주한 해변 산책로. 바다와 다리의 조명을 함께 바라보며 저녁을 보내기 좋습니다.',
    positiveAttributes: { night: 1, nature: 0.85, walk: 0.9, food: 0.7 },
    negativeAttributes: { crowds: 0.8, commercial: 0.6 },
    reviewKeywords: ['광안대교', '해변', '야경'],
  },
  {
    id: 'igidae',
    name: '이기대 해안산책로',
    region: 'busan',
    district: '남구 · 이기대공원',
    latitude: 35.1244,
    longitude: 129.1226,
    category: '자연 / 풍경',
    image: sea,
    description:
      '해안의 바위와 숲을 따라 이어지는 산책로. 구간별 경사와 계단이 있어 편한 신발을 준비해 주세요.',
    positiveAttributes: { nature: 1, quiet: 0.8, walk: 1, activity: 0.8 },
    negativeAttributes: { access: 0.9 },
    reviewKeywords: ['해안', '숲길', '트레킹'],
  },
].map((p) => ({ ...p, country: '대한민국', source: 'curated-demo' }) as Place);
export const demoExperiences: Experience[] = [
  {
    id: 'demo-1',
    placeName: '교토 · 히가시야마',
    rating: 5,
    likes: ['walk', 'architecture', 'quiet'],
    dislikes: ['crowds'],
    goodReason: '낮은 집이 이어지는 조용한 골목을 걷는 시간이 좋았어요.',
    badReason: '주요 관광지는 사람이 많았어요.',
    updatedAt: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'demo-2',
    placeName: '전주 · 한옥마을',
    rating: 4,
    likes: ['architecture', 'culture', 'local', 'walk'],
    dislikes: ['commercial'],
    goodReason: '전통 건축과 동네의 이야기가 기억에 남아요.',
    badReason: '',
    updatedAt: '2026-02-12T00:00:00.000Z',
  },
];

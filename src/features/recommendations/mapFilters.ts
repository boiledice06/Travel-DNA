import type { Attribute, Place } from '../../types';

// Server results have no local attribute vectors. Only match the category/keyword
// actually returned by the server; never infer qualities from a place name.
const terms: Record<Attribute, string[]> = {
  walk: ['산책', '둘레길', '골목'],
  nature: ['자연', '공원', '숲', '정원', '수목원', '산'],
  architecture: ['건축', '궁궐', '한옥', '고궁'],
  food: ['음식', '맛집', '식당', '카페', '먹거리'],
  quiet: ['조용', '한적'],
  night: ['야경', '야간', '밤'],
  culture: ['문화', '박물관', '미술관', '전시', '역사', '궁궐'],
  local: ['현지', '전통시장', '지역'],
  shopping: ['쇼핑', '시장', '상점'],
  activity: ['체험', '레포츠', '액티비티'],
};
export function matchesMapFilter(place: Place, filter: Attribute | null): boolean {
  if (!filter) return true;
  if (place.source !== 'api') return (place.positiveAttributes[filter] ?? 0) >= 0.5;
  const category = place.category.toLowerCase();
  return terms[filter].some((term) => category.includes(term));
}

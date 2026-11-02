import {
  ATTRIBUTES,
  CONFLICTS,
  type Experience,
  type TravelDNA,
  type Vector,
  type Attribute,
  type Conflict,
} from '../../types/index.ts';
export function calculateDNA(experiences: Experience[]): TravelDNA {
  const preferences = Object.fromEntries(ATTRIBUTES.map((k) => [k, 0])) as Vector<Attribute>;
  const aversions = Object.fromEntries(CONFLICTS.map((k) => [k, 0])) as Vector<Conflict>;
  for (const record of experiences) {
    const rating = Math.max(1, Math.min(5, record.rating));
    // Likes remain positive even in an otherwise disappointing trip.
    for (const key of new Set(record.likes)) preferences[key] += rating / 5;
    for (const key of new Set(record.dislikes)) aversions[key] += (6 - rating) / 5 + 0.5;
  }
  const pMax = Math.max(1, ...Object.values(preferences));
  const aMax = Math.max(1, ...Object.values(aversions));
  for (const key of ATTRIBUTES) preferences[key] /= pMax;
  for (const key of CONFLICTS) aversions[key] /= aMax;
  const top = [...ATTRIBUTES].sort((a, b) => preferences[b] - preferences[a])[0];
  const title = Object.values(preferences).every((v) => v === 0)
    ? '당신의 여행 취향을 발견해요'
    : top === 'walk' || top === 'quiet'
      ? '당신은 감성 산책형 여행자'
      : top === 'architecture' || top === 'culture'
        ? '당신은 이야기 수집형 여행자'
        : top === 'nature'
          ? '당신은 풍경을 찾는 여행자'
          : top === 'food' || top === 'local'
            ? '당신은 현지 탐험형 여행자'
            : '당신은 새로운 장면을 찾는 여행자';
  return { preferences, aversions, evidenceCount: experiences.length, title };
}

import {
  ATTRIBUTES,
  CONFLICTS,
  type Place,
  type Recommendation,
  type TravelDNA,
} from '../../types/index.ts';
import { attributeLabels, conflictLabels } from '../../data/mock/places.ts';
export interface RecommendationService {
  recommend(dna: TravelDNA, places: Place[]): Promise<Recommendation[]>;
}
/**
 * Heuristic compatibility index, NOT a probability or learned prediction.
 * P = weighted mean of place strengths using positive preference weights.
 * C = weighted mean of place risks using avoidance weights.
 * Score = round(clamp(50 + 50P - 35C, 0, 100)). No evidence => 50.
 * Sorting ties by ID is deterministic. No popularity or invented reviews.
 */
export function rankPlaces(dna: TravelDNA, dataset: Place[]): Recommendation[] {
  const pTotal = Object.values(dna.preferences).reduce((a, b) => a + b, 0);
  const cTotal = Object.values(dna.aversions).reduce((a, b) => a + b, 0);
  return dataset
    .map((place) => {
      const positive =
        ATTRIBUTES.reduce(
          (sum, k) => sum + dna.preferences[k] * (place.positiveAttributes[k] ?? 0),
          0,
        ) / (pTotal || 1);
      const negative =
        CONFLICTS.reduce(
          (sum, k) => sum + dna.aversions[k] * (place.negativeAttributes[k] ?? 0),
          0,
        ) / (cTotal || 1);
      const matchedAttributes = ATTRIBUTES.filter(
        (k) => dna.preferences[k] > 0 && (place.positiveAttributes[k] ?? 0) >= 0.4,
      ).sort(
        (a, b) =>
          dna.preferences[b] * (place.positiveAttributes[b] ?? 0) -
          dna.preferences[a] * (place.positiveAttributes[a] ?? 0),
      );
      const conflictingAttributes = CONFLICTS.filter(
        (k) => dna.aversions[k] > 0 && (place.negativeAttributes[k] ?? 0) >= 0.3,
      ).sort(
        (a, b) =>
          dna.aversions[b] * (place.negativeAttributes[b] ?? 0) -
          dna.aversions[a] * (place.negativeAttributes[a] ?? 0),
      );
      const liked = matchedAttributes
        .slice(0, 2)
        .map((k) => attributeLabels[k])
        .join(' · ');
      const risk = conflictingAttributes
        .slice(0, 1)
        .map((k) => conflictLabels[k])
        .join('');
      const reason = liked
        ? `기록에서 선호한 ${liked} 특성이 있어요.${risk ? ` ${risk} 가능성을 고려해 주세요.` : ''}`
        : pTotal === 0 && cTotal === 0
          ? '아직 취향 정보가 없어요. 여행 기록을 추가하면 추천이 달라져요.'
          : risk
            ? `선호 특성의 일치는 적고, 기피한 ${risk}과 충돌할 수 있어요.`
            : '현재 기록과 뚜렷하게 일치하는 선호 특성이 적어요.';
      return {
        placeId: place.id,
        score: Math.round(Math.max(0, Math.min(100, 50 + 50 * positive - 35 * negative))),
        matchedAttributes,
        conflictingAttributes,
        reason,
      };
    })
    .sort((a, b) => b.score - a.score || a.placeId.localeCompare(b.placeId));
}
export class LocalRecommendationService implements RecommendationService {
  async recommend(dna: TravelDNA, dataset: Place[]) {
    return rankPlaces(dna, dataset);
  }
}

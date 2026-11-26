import { decodePlacePhoto } from '../backend/photos.ts';
import { safeTourImage } from '../backend/client.ts';
import {
  ATTRIBUTES,
  CONFLICTS,
  type RecommendationRequest,
  type RecommendationResponse,
  type SavedPlace,
} from '../../types/index.ts';
import { places } from '../../data/mock/places.ts';
import { rankPlaces } from './index.ts';

const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const region = (v: unknown) => v === 'seoul' || v === 'busan';
const coordinates = (v: Record<string, unknown>) =>
  typeof v.latitude === 'number' &&
  Number.isFinite(v.latitude) &&
  Math.abs(v.latitude) <= 90 &&
  typeof v.longitude === 'number' &&
  Number.isFinite(v.longitude) &&
  Math.abs(v.longitude) <= 180;
export function validateRequest(request: RecommendationRequest): void {
  const vector = (v: unknown, keys: readonly string[]) =>
    object(v) &&
    Object.keys(v).length === keys.length &&
    keys.every(
      (k) =>
        typeof v[k] === 'number' &&
        Number.isFinite(v[k]) &&
        (v[k] as number) >= 0 &&
        (v[k] as number) <= 1,
    );
  if (
    !object(request) ||
    !vector(request.preferences, ATTRIBUTES) ||
    !vector(request.aversions, CONFLICTS) ||
    !object(request.keywords) ||
    !Array.isArray(request.keywords.positive) ||
    !request.keywords.positive.every(text) ||
    !Array.isArray(request.keywords.negative) ||
    !request.keywords.negative.every(text) ||
    !object(request.conditions) ||
    !region(request.conditions.region) ||
    (['budget', 'availableTime', 'companions', 'purpose'] as const).some(
      (k) => request.conditions[k] !== undefined && !text(request.conditions[k]),
    )
  )
    throw new Error('추천 요청 형식이 올바르지 않습니다.');
}
// The proposed wire contract deliberately does not assume any provider's schema.
export function adaptResponse(
  raw: unknown,
  expectedRegion: RecommendationRequest['conditions']['region'],
): RecommendationResponse {
  if (!object(raw) || !Array.isArray(raw.places))
    throw new Error('추천 서버 응답 형식이 올바르지 않습니다.');
  const ids = new Set<string>();
  const result: RecommendationResponse = { places: [], recommendations: [], origin: 'api' };
  for (const row of raw.places) {
    if (
      !object(row) ||
      !text(row.id) ||
      !text(row.name) ||
      row.region !== expectedRegion ||
      !text(row.category) ||
      !text(row.reason) ||
      !text(row.source) ||
      !coordinates(row)
    )
      throw new Error('추천 장소 정보가 올바르지 않습니다.');
    const id = `api:${encodeURIComponent(row.source)}:${encodeURIComponent(row.id)}`;
    if (ids.has(id)) throw new Error('추천 장소 ID가 중복되었습니다.');
    ids.add(id);
    result.places.push({
      id,
      externalId: row.id,
      name: row.name,
      region: expectedRegion,
      country: typeof row.country === 'string' ? row.country : '',
      district: typeof row.district === 'string' ? row.district : '',
      latitude: row.latitude as number,
      longitude: row.longitude as number,
      description: typeof row.description === 'string' ? row.description : '',
      image: '',
      category: row.category,
      positiveAttributes: {},
      negativeAttributes: {},
      reviewKeywords: [],
      source: 'api',
      sourceName: row.source,
    });
    result.recommendations.push({
      placeId: id,
      score: null,
      matchedAttributes: [],
      conflictingAttributes: [],
      reason: row.reason,
    });
  }
  return result;
}
export function validateSavedPlaces(raw: unknown): SavedPlace[] {
  if (!Array.isArray(raw)) throw new Error('저장된 장소 형식이 올바르지 않습니다.');
  const ids = new Set<string>();
  return raw.map((entry: unknown) => {
    if (!object(entry) || !object(entry.place) || !object(entry.recommendation))
      throw new Error('저장된 장소 형식이 올바르지 않습니다.');
    const p = entry.place,
      r = entry.recommendation;
    if (
      p.source !== 'api' ||
      !text(p.externalId) ||
      !text(p.sourceName) ||
      !text(p.name) ||
      !text(p.category) ||
      !region(p.region) ||
      !coordinates(p) ||
      p.id !== `api:${encodeURIComponent(p.sourceName)}:${encodeURIComponent(p.externalId)}` ||
      r.placeId !== p.id ||
      !text(r.reason) ||
      r.score !== null ||
      !Array.isArray(r.matchedAttributes) ||
      r.matchedAttributes.length ||
      !Array.isArray(r.conflictingAttributes) ||
      r.conflictingAttributes.length ||
      typeof p.country !== 'string' ||
      typeof p.district !== 'string' ||
      typeof p.description !== 'string' ||
      (p.image !== '' && (typeof p.image !== 'string' || safeTourImage(p.image) !== p.image)) ||
      !object(p.positiveAttributes) ||
      Object.keys(p.positiveAttributes).length ||
      !object(p.negativeAttributes) ||
      Object.keys(p.negativeAttributes).length ||
      !Array.isArray(p.reviewKeywords) ||
      p.reviewKeywords.length ||
      ids.has(p.id as string)
    )
      throw new Error('저장된 장소 정보가 올바르지 않습니다.');
    ids.add(p.id as string);
    const saved = entry as unknown as SavedPlace;
    if (p.photo === undefined) return saved;
    return { ...saved, place: { ...saved.place, photo: decodePlacePhoto(p.photo) } };
  });
}
export interface AsyncRecommendationService {
  recommend(request: RecommendationRequest): Promise<RecommendationResponse>;
}
export class RecommendationClient implements AsyncRecommendationService {
  private serverUrl: string | undefined;
  private timeoutMs: number;
  constructor(serverUrl: string | undefined, timeoutMs = 12000) {
    this.serverUrl = serverUrl;
    this.timeoutMs = timeoutMs;
  }
  async recommend(request: RecommendationRequest): Promise<RecommendationResponse> {
    validateRequest(request);
    if (!this.serverUrl?.trim()) {
      const demoPlaces = places.filter((p) => p.region === request.conditions.region);
      return {
        places: demoPlaces,
        recommendations: rankPlaces(
          {
            preferences: request.preferences,
            aversions: request.aversions,
            evidenceCount: 0,
            title: '',
          },
          demoPlaces,
        ),
        origin: 'demo',
      };
    }
    let url: URL;
    try {
      url = new URL(this.serverUrl);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error();
    } catch {
      throw new Error('추천 서버 URL이 올바르지 않습니다.');
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('추천 서버 응답 시간이 초과되었습니다.'));
        }, this.timeoutMs);
      });
      const work = async () => {
        let response: Response;
        try {
          response = await fetch(`${url.toString().replace(/\/$/, '')}/recommendations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
            signal: controller.signal,
          });
        } catch {
          throw new Error('추천 서버에 연결하지 못했습니다.');
        }
        if (!response.ok) throw new Error(`추천 서버 오류 (HTTP ${response.status})`);
        let raw: unknown;
        try {
          raw = await response.json();
        } catch {
          throw new Error('추천 서버 응답을 읽을 수 없습니다.');
        }
        return adaptResponse(raw, request.conditions.region);
      };
      return await Promise.race([work(), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

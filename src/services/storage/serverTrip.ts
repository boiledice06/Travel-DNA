import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecommendationResponse } from '../../types';
import { validateSavedPlaces } from '../recommendation/api';

const KEY = '@travel-dna/server-trip/v1';
export interface ServerTrip {
  serverUrl: string;
  profileId: string;
  sessionId: string;
  result: RecommendationResponse;
}
export function decodeServerTrip(raw: string): ServerTrip {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('여행 저장 형식 오류');
  const v = value as Record<string, unknown>;
  if (
    v.version !== 1 ||
    typeof v.serverUrl !== 'string' ||
    !v.serverUrl ||
    typeof v.profileId !== 'string' ||
    !v.profileId ||
    typeof v.sessionId !== 'string' ||
    !v.sessionId ||
    !Array.isArray(v.entries)
  )
    throw new Error('여행 저장 형식 오류');
  const entries = validateSavedPlaces(v.entries);
  if (entries.some(({ place }) => place.region !== 'seoul'))
    throw new Error('서울 이외의 장소가 포함되었습니다.');
  return {
    serverUrl: v.serverUrl,
    profileId: v.profileId,
    sessionId: v.sessionId,
    result: {
      origin: 'api',
      places: entries.map((e) => e.place),
      recommendations: entries.map((e) => e.recommendation),
    },
  };
}
export async function readServerTrip(): Promise<ServerTrip | null> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw === null ? null : decodeServerTrip(raw);
}
let writes: Promise<void> = Promise.resolve();
export function writeServerTrip(trip: ServerTrip): Promise<void> {
  const entries = trip.result.places.map((place) => ({
    place,
    recommendation: trip.result.recommendations.find((r) => r.placeId === place.id),
  }));
  const raw = JSON.stringify({
    version: 1,
    serverUrl: trip.serverUrl,
    profileId: trip.profileId,
    sessionId: trip.sessionId,
    entries,
  });
  decodeServerTrip(raw);
  writes = writes.catch(() => undefined).then(() => AsyncStorage.setItem(KEY, raw));
  return writes;
}

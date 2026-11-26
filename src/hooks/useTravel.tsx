import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type AppData,
  type Experience,
  type RegionId,
  type TravelConditions,
  type RecommendationResponse,
  type Recommendation,
  type PlacePhoto,
} from '../types';
import { places } from '../data/mock/places';
import { withReviewedSeoulPhoto } from '../services/photos/seoul';

import { hasDemoRecords, startProfile } from '../features/onboarding/profile';
import { calculateDNA } from '../features/travel-dna/calculate';
import { extractKeywords } from '../features/travel-dna/keywords';
import { recommendationServerUrl } from '../services/presentation/demo';
import { BackendClient } from '../services/backend/client';
import { withPlacePhotos } from '../services/backend/photos';
import { RecommendationClient } from '../services/recommendation/api';
import { rankPlaces } from '../services/recommendation';
import { readData, writeData } from '../services/storage';
import { initialData } from '../services/storage/schema';
import { readServerTrip, writeServerTrip, type ServerTrip } from '../services/storage/serverTrip';
interface TravelContextValue {
  data: AppData;
  ready: boolean;
  loadError: string | null;
  saveError: string | null;
  dna: ReturnType<typeof calculateDNA>;
  recommendations: Recommendation[];
  allPlaces: typeof places;
  activePlaces: typeof places;
  recommendationOrigin: 'demo' | 'api';
  recommendationStatus: 'idle' | 'loading' | 'error' | 'empty';
  recommendationError: string | null;
  requestRecommendations: (conditions: TravelConditions) => void;
  applyServerResult: (trip: ServerTrip) => void;
  serverTrip: ServerTrip | null;
  reload: () => void;
  retrySave: () => void;
  start: (nickname: string, demo: boolean) => void;
  completeOnboarding: () => void;
  upsertExperience: (experience: Experience) => void;
  deleteExperience: (id: string) => void;
  toggleSave: (id: string) => void;
  setRegion: (region: RegionId) => void;
}
const Context = createContext<TravelContextValue | null>(null);
const reviewedDemoPlaces = places.map(withReviewedSeoulPhoto);

export function TravelProvider({ children }: React.PropsWithChildren) {
  const [data, setData] = useState<AppData>(initialData);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const revision = useRef(0);
  useEffect(() => {
    let active = true;
    setLoadError(null);
    readData()
      .then((value) => {
        if (active) {
          setData({ ...value, demo: hasDemoRecords(value.experiences) });
          setReady(true);
        }
      })
      .catch(() => {
        if (active)
          setLoadError(
            '여행 기록을 불러오지 못했어요. 저장 데이터는 보존됩니다. 다시 시도해 주세요.',
          );
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    if (!ready) return;
    const current = ++revision.current;
    writeData(data)
      .then(() => {
        if (current === revision.current) setSaveError(null);
      })
      .catch(() => {
        if (current === revision.current)
          setSaveError('기기에 저장하지 못했어요. 다시 시도해 주세요.');
      });
  }, [data, ready, saveAttempt]);
  const dna = useMemo(() => calculateDNA(data.experiences), [data.experiences]);
  const demoRecommendations = useMemo(() => rankPlaces(dna, places), [dna]);
  const [remoteResult, setRemoteResult] = useState<RecommendationResponse | null>(null);
  const [serverTrip, setServerTrip] = useState<ServerTrip | null>(null);
  const [enrichment, setEnrichment] = useState<{
    trip: ServerTrip;
    photos: Record<string, PlacePhoto>;
  }>();
  useEffect(() => {
    if (!ready) return;
    let active = true;
    readServerTrip()
      .then((trip) => {
        if (
          active &&
          trip &&
          trip.serverUrl === recommendationServerUrl?.trim() &&
          requestId.current === 0
        ) {
          setServerTrip(trip);
          setRemoteResult(trip.result);
          setRecommendationStatus(trip.result.places.length ? 'idle' : 'empty');
        }
      })
      .catch(() => {
        if (active) setSaveError('이전 서버 여행을 불러오지 못했어요. 저장 데이터는 보존됩니다.');
      });
    return () => {
      active = false;
    };
  }, [ready]);
  useEffect(() => {
    if (!serverTrip?.result.places.length) return;
    const trip = serverTrip;
    const generation = requestId.current;
    const controller = new AbortController();
    const client = new BackendClient(trip.serverUrl);
    const pending = trip.result.places.filter((place) => !place.photo && place.region === 'seoul');
    const run = async () => {
      let photos: Record<string, PlacePhoto> = {};
      for (let index = 0; index < pending.length && !controller.signal.aborted; index += 4) {
        const batch = pending.slice(index, index + 4);
        const received = await client.placePhotos(batch, controller.signal).catch(() => ({}));
        if (controller.signal.aborted || generation !== requestId.current) return;
        if (!Object.keys(received).length) continue;
        photos = { ...photos, ...received };
        setEnrichment({ trip, photos });
        const resolved = withPlacePhotos(batch, received);
        const byId = new Map(
          resolved.filter((place) => place.photo).map((place) => [place.id, place]),
        );
        setData((previous) => {
          const savedPlaces = previous.savedPlaces.map((entry) => {
            const place = byId.get(entry.place.id);
            return place &&
              place.name === entry.place.name &&
              place.latitude === entry.place.latitude &&
              place.longitude === entry.place.longitude
              ? { ...entry, place: { ...entry.place, photo: place.photo } }
              : entry;
          });
          return savedPlaces.some((entry, index) => entry !== previous.savedPlaces[index])
            ? { ...previous, savedPlaces }
            : previous;
        });
      }
      if (
        Object.keys(photos).length &&
        !controller.signal.aborted &&
        generation === requestId.current
      ) {
        await writeServerTrip({
          ...trip,
          result: { ...trip.result, places: withPlacePhotos(trip.result.places, photos) },
        }).catch(() => undefined);
      }
    };
    void run();
    return () => controller.abort();
  }, [serverTrip]);

  const remotePlaces = useMemo(() => {
    const source = remoteResult?.places;
    if (!source) return source;
    const enriched =
      enrichment && enrichment.trip === serverTrip && remoteResult === serverTrip?.result
        ? withPlacePhotos(source, enrichment.photos)
        : source;
    return enriched.map(withReviewedSeoulPhoto);
  }, [enrichment, remoteResult, serverTrip]);
  const [recommendationStatus, setRecommendationStatus] = useState<
    'idle' | 'loading' | 'error' | 'empty'
  >('idle');
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const requestId = useRef(0);
  const allPlaces = useMemo(() => {
    const map = new Map(reviewedDemoPlaces.map((p) => [p.id, p]));
    for (const item of data.savedPlaces) map.set(item.place.id, withReviewedSeoulPhoto(item.place));
    for (const p of remotePlaces ?? []) map.set(p.id, p);
    return [...map.values()];
  }, [data.savedPlaces, remotePlaces]);
  const recommendations = useMemo(() => {
    const map = new Map<string, Recommendation>(demoRecommendations.map((r) => [r.placeId, r]));
    for (const r of remoteResult?.recommendations ?? []) map.set(r.placeId, r);
    for (const item of data.savedPlaces)
      if (!map.has(item.recommendation.placeId))
        map.set(item.recommendation.placeId, item.recommendation);
    return [...map.values()];
  }, [demoRecommendations, data.savedPlaces, remoteResult]);
  const requestRecommendations = useCallback(
    (conditions: TravelConditions) => {
      const id = ++requestId.current;
      setRecommendationStatus('loading');
      setRecommendationError(null);
      const client = new RecommendationClient(recommendationServerUrl);
      client
        .recommend({
          preferences: dna.preferences,
          aversions: dna.aversions,
          keywords: extractKeywords(data.experiences),
          conditions,
        })
        .then((result) => {
          if (id !== requestId.current) return;
          setRemoteResult(result);
          setRecommendationStatus(result.places.length ? 'idle' : 'empty');
        })
        .catch((error) => {
          if (id !== requestId.current) return;
          setRemoteResult({ places: [], recommendations: [], origin: 'api' });
          setRecommendationStatus('error');
          setRecommendationError(
            error instanceof Error ? error.message : '추천을 불러오지 못했습니다.',
          );
        });
    },
    [dna, data.experiences],
  );
  const upsertExperience = useCallback(
    (record: Experience) =>
      setData((d) => ({
        ...d,
        experiences: d.experiences.some((e) => e.id === record.id)
          ? d.experiences.map((e) => (e.id === record.id ? record : e))
          : [...d.experiences, record],
      })),
    [],
  );
  const toggleSave = useCallback(
    (id: string) => {
      const place = allPlaces.find((p) => p.id === id);
      const recommendation = recommendations.find((r) => r.placeId === id);
      setData((d) => ({
        ...d,
        savedIds: d.savedIds.includes(id)
          ? d.savedIds.filter((k) => k !== id)
          : [...d.savedIds, id],
        savedPlaces: d.savedIds.includes(id)
          ? d.savedPlaces.filter((item) => item.place.id !== id)
          : place?.source === 'api' && recommendation
            ? [...d.savedPlaces.filter((item) => item.place.id !== id), { place, recommendation }]
            : d.savedPlaces,
      }));
    },
    [allPlaces, recommendations],
  );
  return (
    <Context.Provider
      value={{
        data,
        ready,
        loadError,
        saveError,
        dna,
        recommendations,
        allPlaces,
        activePlaces:
          remoteResult?.origin === 'api'
            ? (remotePlaces ?? remoteResult.places)
            : reviewedDemoPlaces,
        recommendationOrigin: remoteResult?.origin ?? 'demo',
        recommendationStatus,
        recommendationError,
        requestRecommendations,
        serverTrip,
        applyServerResult: (trip) => {
          const result = trip.result;
          requestId.current++;
          setServerTrip(trip);
          setRemoteResult(result);
          writeServerTrip(trip).catch(() =>
            setSaveError('서버 여행을 기기에 저장하지 못했어요. 다시 추천을 요청해 주세요.'),
          );
          setRecommendationStatus(result.places.length ? 'idle' : 'empty');
          setRecommendationError(
            result.places.length
              ? null
              : '유효한 서울 장소가 없어요. 조건을 바꾸어 다시 시도해 주세요.',
          );
        },
        reload: () => setAttempt((n) => n + 1),
        retrySave: () => setSaveAttempt((n) => n + 1),
        start: (nickname, demo) => setData((d) => startProfile(d, nickname, demo)),
        completeOnboarding: () => setData((d) => ({ ...d, onboarded: true })),
        upsertExperience,
        deleteExperience: (id) =>
          setData((d) => ({
            ...d,
            experiences: d.experiences.filter((e) => e.id !== id),
            demo: hasDemoRecords(d.experiences.filter((e) => e.id !== id)),
          })),
        toggleSave,
        setRegion: (region) => {
          requestId.current++;
          setRemoteResult(null);
          setRecommendationStatus('idle');
          setRecommendationError(null);
          setData((d) => ({ ...d, region }));
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useTravel() {
  const context = useContext(Context);
  if (!context) throw new Error('TravelProvider is missing');
  return context;
}

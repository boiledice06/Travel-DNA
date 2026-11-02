import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type AppData, type Experience, type RegionId } from '../types';
import { places } from '../data/mock/places';
import { hasDemoRecords, startProfile } from '../features/onboarding/profile';
import { calculateDNA } from '../features/travel-dna/calculate';
import { rankPlaces } from '../services/recommendation';
import { readData, writeData } from '../services/storage';
import { initialData } from '../services/storage/schema';
interface TravelContextValue {
  data: AppData;
  ready: boolean;
  loadError: string | null;
  saveError: string | null;
  dna: ReturnType<typeof calculateDNA>;
  recommendations: ReturnType<typeof rankPlaces>;
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
  const recommendations = useMemo(() => rankPlaces(dna, places), [dna]);
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
    (id: string) =>
      setData((d) => ({
        ...d,
        savedIds: d.savedIds.includes(id)
          ? d.savedIds.filter((k) => k !== id)
          : [...d.savedIds, id],
      })),
    [],
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
        setRegion: (region) => setData((d) => ({ ...d, region })),
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

import { ATTRIBUTES, CONFLICTS, type AppData, type Experience } from '../../types/index.ts';
export const initialData: AppData = {
  version: 1,
  nickname: '',
  onboarded: false,
  demo: false,
  experiences: [],
  savedIds: [],
  region: 'seoul',
};
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
export function isExperience(value: unknown): value is Experience {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.placeName === 'string' &&
    value.placeName.trim().length > 0 &&
    typeof value.rating === 'number' &&
    Number.isInteger(value.rating) &&
    value.rating >= 1 &&
    value.rating <= 5 &&
    Array.isArray(value.likes) &&
    value.likes.every((k) => ATTRIBUTES.includes(k)) &&
    Array.isArray(value.dislikes) &&
    value.dislikes.every((k) => CONFLICTS.includes(k)) &&
    typeof value.goodReason === 'string' &&
    typeof value.badReason === 'string' &&
    typeof value.updatedAt === 'string'
  );
}
export function decodeData(raw: string): AppData {
  const value: unknown = JSON.parse(raw);
  if (
    !isObject(value) ||
    value.version !== 1 ||
    typeof value.nickname !== 'string' ||
    typeof value.onboarded !== 'boolean' ||
    typeof value.demo !== 'boolean' ||
    !Array.isArray(value.experiences) ||
    !value.experiences.every(isExperience) ||
    !Array.isArray(value.savedIds) ||
    !value.savedIds.every((k) => typeof k === 'string') ||
    (value.region !== 'seoul' && value.region !== 'busan')
  )
    throw new Error('저장된 데이터 형식을 확인할 수 없습니다.');
  if (new Set(value.experiences.map((e) => e.id)).size !== value.experiences.length)
    throw new Error('여행 기록 ID가 중복되어 있습니다.');
  return { ...initialData, ...value, savedIds: [...new Set(value.savedIds)] } as AppData;
}

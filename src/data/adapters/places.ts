import { ATTRIBUTES, CONFLICTS, type Place } from '../../types/index.ts';
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
function vector(v: unknown, keys: readonly string[]): boolean {
  return (
    object(v) &&
    Object.entries(v).every(
      ([k, n]) =>
        keys.includes(k) && typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1,
    )
  );
}
/**
 * Accepts JSON decoded to unknown, or parsed CSV rows whose vector columns have
 * already been JSON-decoded and numeric columns converted by the importer.
 * This boundary validates data; it never invents review-derived attributes.
 * Raw CSV quoting/encoding belongs to a future importer, not this adapter.
 */
export function adaptPlaceRows(rows: unknown): Place[] {
  if (!Array.isArray(rows)) throw new Error('장소 데이터는 배열이어야 합니다.');
  const ids = new Set<string>();
  return rows.map((row: unknown) => {
    if (!object(row)) throw new Error('잘못된 장소 레코드');
    for (const k of ['id', 'name', 'country', 'district', 'description', 'image', 'category'])
      if (typeof row[k] !== 'string' || !row[k].trim()) throw new Error('필수 텍스트 누락: ' + k);
    if (row.region !== 'seoul' && row.region !== 'busan') throw new Error('지원하지 않는 지역');
    if (
      typeof row.latitude !== 'number' ||
      !Number.isFinite(row.latitude) ||
      Math.abs(row.latitude) > 90 ||
      typeof row.longitude !== 'number' ||
      !Number.isFinite(row.longitude) ||
      Math.abs(row.longitude) > 180
    )
      throw new Error('잘못된 좌표');
    if (!vector(row.positiveAttributes, ATTRIBUTES) || !vector(row.negativeAttributes, CONFLICTS))
      throw new Error('특성 값은 0–1이어야 합니다.');
    if (
      !Array.isArray(row.reviewKeywords) ||
      !row.reviewKeywords.every((k) => typeof k === 'string')
    )
      throw new Error('키워드는 문자열 배열이어야 합니다.');
    if (row.source !== 'curated-demo')
      throw new Error(
        'MVP는 curated-demo 소스만 지원합니다. 리뷰 분석을 연결할 때 소스 타입과 화면 고지를 함께 확장하세요.',
      );
    const id = row.id as string;
    if (ids.has(id)) throw new Error('중복 장소 ID: ' + id);
    ids.add(id);
    return row as unknown as Place;
  });
}

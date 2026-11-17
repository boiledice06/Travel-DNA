import type { RecommendationResponse } from '../../types/index.ts';

export type ChatPhase = 'likert' | 'asking' | 'constraints' | 'draft' | 'confirmed';
export interface ChatTurn {
  session_id: string;
  phase: ChatPhase;
  turn: number;
  assistant_message: string;
  chips: string[];
}
export interface ChatStart extends ChatTurn {
  likert_items: {
    id: string;
    statement_ko: string;
    scale: { value: number; label_ko: string }[];
  }[];
}
export interface TripProfileInput {
  party_size: '1' | '2' | '3-4' | '5+';
  companion_type: 'solo' | 'couple' | 'friends' | 'family' | 'with_kids';
  duration: 'half_day' | 'full_day' | '1n2d' | '2n3d';
  transport: 'walk_subway' | 'bus_ok' | 'taxi_car' | 'minimize';
  budget_level: 'low' | 'mid' | 'high';
  budget_note?: string;
  time_window: 'morning' | 'afternoon' | 'evening';
}
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();

function parseTurn(raw: unknown): ChatTurn {
  if (
    !object(raw) ||
    !text(raw.session_id) ||
    !['likert', 'asking', 'constraints', 'draft', 'confirmed'].includes(String(raw.phase)) ||
    typeof raw.turn !== 'number' ||
    typeof raw.assistant_message !== 'string' ||
    !Array.isArray(raw.chips) ||
    !raw.chips.every((v: unknown) => typeof v === 'string')
  )
    throw new Error('서버 대화 응답이 올바르지 않습니다.');
  return {
    session_id: raw.session_id,
    phase: raw.phase as ChatPhase,
    turn: raw.turn,
    assistant_message: raw.assistant_message,
    chips: raw.chips,
  };
}

/** The server's ranking score is deliberately not converted into an app match score. */
export function adaptShortlist(raw: unknown): RecommendationResponse {
  if (!object(raw) || !Array.isArray(raw.shortlist))
    throw new Error('서버 장소 목록 형식이 올바르지 않습니다.');
  const result: RecommendationResponse = { places: [], recommendations: [], origin: 'api' };
  const ids = new Set<string>();
  for (const row of raw.shortlist) {
    if (
      !object(row) ||
      !text(row.name) ||
      !text(row.place_id) ||
      !text(row.source) ||
      typeof row.lat !== 'number' ||
      typeof row.lng !== 'number' ||
      !Number.isFinite(row.lat) ||
      !Number.isFinite(row.lng) ||
      row.lat < 37.4 ||
      row.lat > 37.75 ||
      row.lng < 126.75 ||
      row.lng > 127.2
    )
      continue;
    const id = `api:${encodeURIComponent(row.source)}:${encodeURIComponent(row.place_id)}`;
    if (ids.has(id)) continue;
    ids.add(id);
    result.places.push({
      id,
      externalId: row.place_id,
      name: row.name,
      region: 'seoul',
      country: '대한민국',
      district: typeof row.address === 'string' ? row.address : '',
      latitude: row.lat,
      longitude: row.lng,
      description: '',
      image: '',
      category: text(row.source_keyword) ? row.source_keyword : '장소',
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
      reason: '서버에서 별도의 추천 이유를 제공하지 않았어요.',
    });
  }
  return result;
}

export class BackendClient {
  private baseUrl: string;
  private timeoutMs: number;
  constructor(baseUrl: string, timeoutMs = 12000) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }
  private async request(
    path: string,
    body?: unknown,
    timeoutMs = this.timeoutMs,
  ): Promise<unknown> {
    let url: URL;
    try {
      url = new URL(this.baseUrl);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw Error();
    } catch {
      throw new Error('서버 URL이 올바르지 않습니다.');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${url.toString().replace(/\/$/, '')}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(body !== undefined && { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 404)
          throw new Error('서버 세션을 찾을 수 없어요. 여행 분석을 다시 시작해 주세요.');
        if (response.status === 401 || response.status === 403)
          throw new Error('서버 인증에 실패했어요. 서버 설정을 확인해 주세요.');
        if (response.status === 502 || response.status === 503)
          throw new Error(
            `서버 또는 외부 서비스에 연결하지 못했어요 (HTTP ${response.status}). 서버 인증과 API 키를 확인한 뒤 재시도해 주세요.`,
          );
        throw new Error(`서버 오류 (HTTP ${response.status}). 입력을 확인하고 다시 시도해 주세요.`);
      }
      try {
        return await response.json();
      } catch {
        throw new Error('서버 응답이 올바른 JSON이 아닙니다.');
      }
    } catch (error) {
      if (controller.signal.aborted) throw new Error('서버 응답 시간이 초과되었습니다.');
      if (error instanceof TypeError) throw new Error('서버에 연결하지 못했습니다.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  async createProfile(input: TripProfileInput): Promise<{ id: string }> {
    const raw = await this.request('/api/trip-profile', input);
    if (!object(raw) || !text(raw.id)) throw new Error('여행 프로필 응답이 올바르지 않습니다.');
    return { id: raw.id };
  }
  async start(): Promise<ChatStart> {
    const raw = await this.request('/api/dna-chat/start', {});
    const turn = parseTurn(raw);
    if (
      !object(raw) ||
      !Array.isArray(raw.likert_items) ||
      !raw.likert_items.length ||
      !raw.likert_items.every(
        (item: unknown) =>
          object(item) &&
          text(item.id) &&
          text(item.statement_ko) &&
          Array.isArray(item.scale) &&
          item.scale.length === 5 &&
          item.scale.every(
            (option: unknown) =>
              object(option) &&
              typeof option.value === 'number' &&
              Number.isInteger(option.value) &&
              option.value >= 1 &&
              option.value <= 5 &&
              text(option.label_ko),
          ),
      )
    )
      throw new Error('설문 응답 형식이 올바르지 않습니다.');
    return {
      ...turn,
      likert_items: raw.likert_items.map(
        (item: {
          id: string;
          statement_ko: string;
          scale: { value: number; label_ko: string }[];
        }) => ({
          id: item.id,
          statement_ko: item.statement_ko,
          scale: item.scale,
        }),
      ),
    };
  }
  getSession(id: string) {
    return this.request(`/api/dna-chat/${encodeURIComponent(id)}`);
  }
  async likert(session_id: string, answers: { id: string; value: number }[]) {
    return parseTurn(await this.request('/api/dna-chat/likert', { session_id, answers }));
  }
  async message(session_id: string, message: string) {
    return parseTurn(await this.request('/api/dna-chat/message', { session_id, message }));
  }
  async constraints(session_id: string, must_have: string, must_avoid: string) {
    return parseTurn(
      await this.request('/api/dna-chat/constraints', { session_id, must_have, must_avoid }),
    );
  }
  async finalize(session_id: string) {
    const raw = await this.request('/api/dna-chat/finalize', { session_id, confirm: true });
    if (!object(raw) || raw.session_id !== session_id || raw.phase !== 'confirmed')
      throw new Error('취향 확정 응답이 올바르지 않습니다.');
    return raw;
  }
  async find(profile_id: string, dna_session_id: string) {
    return adaptShortlist(
      await this.request('/api/seoul-find', { profile_id, dna_session_id }, 120000),
    );
  }
}

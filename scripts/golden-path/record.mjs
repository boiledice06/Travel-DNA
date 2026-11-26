import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { adaptShortlist } from '../../src/services/backend/client.ts';
import { decodePlacePhoto } from '../../src/services/backend/photos.ts';

const base = 'http://127.0.0.1:8778';
const profile = {
  party_size: '2',
  companion_type: 'friends',
  duration: '2n3d',
  transport: 'walk_subway',
  budget_level: 'mid',
  time_window: 'morning',
};
const purpose = '조용한 박물관과 미술 전시를 관람하고 여유롭게 산책하고 싶어요.';
const wanted = '박물관, 미술관';
const avoided = '술집';
const answers = [4, 2, 2, 3, 3];
const replies = [
  '조용한 회화 전시에 관심이 있어요.',
  '작은 미술관과 차분한 박물관이 좋아요. 관람을 마치고 한적한 골목을 걷고 싶어요.',
  '조용한 전시와 산책을 먼저 하고 싶어요. 사람 많은 야간 술집은 피하고 싶어요.',
  '오전에 박물관과 미술관을 방문하고, 오후에는 천천히 산책하고 싶어요.',
];
const target = resolve(process.argv[2] ?? '.codex-temp/golden-path/recording.json');
const calls = [];
let rawProfileId;
let rawSessionId;
const replaceIds = (value) => {
  if (typeof value === 'string') {
    if (value === rawProfileId) return 'golden-profile';
    if (value === rawSessionId) return 'golden-session';
    return value;
  }
  if (Array.isArray(value)) return value.map(replaceIds);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceIds(item)]));
  return value;
};
async function call(route, request, cleanRoute = route) {
  const started = performance.now();
  const response = await fetch(base + route, {
    method: request === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: request === undefined ? undefined : JSON.stringify(request),
    signal: AbortSignal.timeout(119000),
  });
  const elapsedMs = Math.round(performance.now() - started);
  console.log(cleanRoute, response.status, elapsedMs + 'ms');
  if (!response.ok) {
    const failure = await response.json().catch(() => null);
    const code = failure?.detail?.code;
    throw new Error(
      cleanRoute +
        ' HTTP ' +
        response.status +
        (typeof code === 'string' && /^model_[a-z_]+$/.test(code) ? ' ' + code : ''),
    );
  }
  const result = await response.json();
  calls.push({
    method: request === undefined ? 'GET' : 'POST',
    path: cleanRoute,
    request: request ?? null,
    response: result,
    status: response.status,
    elapsedMs,
  });
  return result;
}
const registration = await call('/api/trip-profile', profile);
rawProfileId = registration.id;
const session = await call('/api/dna-chat/start', {});
rawSessionId = session.session_id;
if (session.likert_items?.length !== answers.length)
  throw Error('Unexpected number of live survey items');
let turn = await call('/api/dna-chat/likert', {
  session_id: rawSessionId,
  answers: session.likert_items.map((item, index) => ({ id: item.id, value: answers[index] })),
});
for (const message of replies) {
  if (turn.phase !== 'asking') break;
  turn = await call('/api/dna-chat/message', { session_id: rawSessionId, message });
}
if (turn.phase !== 'constraints') throw Error('Captured conversation did not reach constraints');
const draft = await call('/api/dna-chat/constraints', {
  session_id: rawSessionId,
  must_have: '여행 목적: ' + purpose + '\n' + wanted,
  must_avoid: avoided,
});
if (draft.phase !== 'draft') throw Error('Expected a real draft');
const finalized = await call('/api/dna-chat/finalize', { session_id: rawSessionId, confirm: true });
if (finalized.phase !== 'confirmed') throw Error('Expected a confirmed result');
const found = await call('/api/seoul-find', {
  profile_id: rawProfileId,
  dna_session_id: rawSessionId,
});
const stored = await call(
  '/api/dna-chat/' + rawSessionId,
  undefined,
  '/api/dna-chat/golden-session',
);
const result = adaptShortlist(found);
if (!result.places.length || stored.phase !== 'confirmed')
  throw Error('Live recommendation or session is incomplete');
let attached = 0;
const placeIds = [];
for (let index = 0; index < result.places.length; index += 4) {
  const places = result.places
    .slice(index, index + 4)
    .map(({ id, name, district, latitude, longitude }) => ({
      id,
      name,
      address: district,
      latitude,
      longitude,
    }));
  const data = await call('/api/place-photos', { places });
  if (data.map((item) => item.id).join('|') !== places.map((place) => place.id).join('|'))
    throw Error('Unexpected photo response order');
  for (const item of data)
    if (decodePlacePhoto(item.photo)) {
      attached++;
      placeIds.push(item.id);
    }
}
const record = replaceIds({
  version: 1,
  recordedOn: '2026-11-25',
  timezone: 'Asia/Seoul',
  provenance:
    'Synthetic presentation inputs sent to the existing live FastAPI/Gemini/Kakao/TourAPI and photo enrichment. This recording contains one confirmed trip. Runtime identifiers were replaced consistently. No response was simulated.',
  scenario: { profile, purpose, mustHave: wanted, mustAvoid: avoided, answers },
  calls,
  summary: {
    places: result.places.length,
    verifiedPhotos: attached,
    photoPlaceIds: placeIds,
    placeProviders: Object.fromEntries(
      [...new Set(result.places.map((p) => p.sourceName))].map((source) => [
        source,
        result.places.filter((p) => p.sourceName === source).length,
      ]),
    ),
    messages: calls.filter((item) => item.path === '/api/dna-chat/message').length,
  },
});
await mkdir(dirname(target), { recursive: true });
await writeFile(target, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(record.summary));

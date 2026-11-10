import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDNA } from '../src/features/travel-dna/calculate.ts';
import { extractKeywords } from '../src/features/travel-dna/keywords.ts';
import {
  RecommendationClient,
  adaptResponse,
  validateRequest,
} from '../src/services/recommendation/api.ts';
import { decodeData, initialData } from '../src/services/storage/schema.ts';
import { demoExperiences } from '../src/data/mock/places.ts';
const dna = calculateDNA(demoExperiences);
const request = {
  preferences: dna.preferences,
  aversions: dna.aversions,
  keywords: extractKeywords(demoExperiences),
  conditions: { region: 'seoul' as const },
};
const row = {
  id: '123',
  name: '장소',
  latitude: 37.5,
  longitude: 127,
  region: 'seoul',
  category: '문화',
  reason: '추천 근거',
  source: 'provider',
};
test('keyword extraction keeps literal positive and negative text separate', () => {
  const e = { ...demoExperiences[0], goodReason: '조용한 바다 조용한', badReason: '긴 대기' };
  assert.deepEqual(extractKeywords([e]), { positive: ['바다', '조용한'], negative: ['대기'] });
});
test('request and response reject invalid vectors, coordinates, IDs and duplicates', () => {
  validateRequest(request);
  assert.throws(() =>
    validateRequest({ ...request, preferences: { ...request.preferences, food: NaN } }),
  );
  assert.throws(() => adaptResponse({ places: [{ ...row, latitude: 91 }] }, 'seoul'));
  assert.throws(() => adaptResponse({ places: [{ ...row, id: '' }] }, 'seoul'));
  assert.throws(() => adaptResponse({ places: [row, row] }, 'seoul'));
  assert.throws(() => adaptResponse({ places: [{ ...row, region: 'busan' }] }, 'seoul'));
  assert.equal(adaptResponse({ places: [] }, 'seoul').places.length, 0);
});
test('fallback is explicitly demo, filters region and retains local scoring', async () => {
  const result = await new RecommendationClient(undefined).recommend(request);
  assert.equal(result.origin, 'demo');
  assert.ok(result.places.length && result.places.every((p) => p.region === 'seoul'));
  assert.ok(result.recommendations.every((r) => typeof r.score === 'number'));
});
test('API sends request, validates response, and distinguishes network, HTTP, invalid JSON and timeout', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      assert.deepEqual(JSON.parse(String(options?.body)), request);
      return new Response(JSON.stringify({ places: [row] }), { status: 200 });
    };
    const result = await new RecommendationClient('https://example.org').recommend(request);
    assert.equal(result.origin, 'api');
    assert.equal(result.places[0].externalId, '123');
    assert.equal(result.recommendations[0].score, null);
    globalThis.fetch = async () => {
      throw new Error('offline');
    };
    await assert.rejects(
      new RecommendationClient('https://example.org').recommend(request),
      /연결/,
    );
    globalThis.fetch = async () => new Response('', { status: 503 });
    await assert.rejects(new RecommendationClient('https://example.org').recommend(request), /503/);
    globalThis.fetch = async () => new Response('bad');
    await assert.rejects(
      new RecommendationClient('https://example.org').recommend(request),
      /읽을 수/,
    );
    globalThis.fetch = async () => new Promise(() => {});
    await assert.rejects(
      new RecommendationClient('https://example.org', 5).recommend(request),
      /초과/,
    );
    await assert.rejects(new RecommendationClient('bad url').recommend(request), /URL/);
  } finally {
    globalThis.fetch = original;
  }
});
test('v1 migration preserves fields; saved API snapshots survive roundtrip and malformed snapshots fail', () => {
  const { savedPlaces: _, ...v1 } = initialData;
  assert.deepEqual(decodeData(JSON.stringify(v1)), initialData);
  const result = adaptResponse({ places: [row] }, 'seoul');
  const data = {
    ...initialData,
    savedIds: [result.places[0].id],
    savedPlaces: [{ place: result.places[0], recommendation: result.recommendations[0] }],
  };
  assert.deepEqual(decodeData(JSON.stringify(data)), data);
  assert.throws(() =>
    decodeData(
      JSON.stringify({
        ...data,
        savedPlaces: [
          { ...data.savedPlaces[0], place: { ...data.savedPlaces[0].place, latitude: null } },
        ],
      }),
    ),
  );
});

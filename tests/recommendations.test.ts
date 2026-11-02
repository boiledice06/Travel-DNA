import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDNA } from '../src/features/travel-dna/calculate.ts';
import { rankPlaces, LocalRecommendationService } from '../src/services/recommendation/index.ts';
import { demoExperiences, places } from '../src/data/mock/places.ts';
import { decodeData, initialData } from '../src/services/storage/schema.ts';
import { adaptPlaceRows } from '../src/data/adapters/places.ts';
import type { Attribute, Conflict, Experience } from '../src/types/index.ts';
import { startProfile } from '../src/features/onboarding/profile.ts';
const record = (likes: Attribute[], dislikes: Conflict[] = [], rating = 5): Experience => ({
  id: 'test',
  placeName: '테스트 여행',
  rating,
  likes,
  dislikes,
  goodReason: '',
  badReason: '',
  updatedAt: '2026-10-13T00:00:00Z',
});
const seoul = places.filter((p) => p.region === 'seoul');
test('demo start preserves personal experience records and saved places', () => {
  const personal = record(['food']);
  const data = { ...initialData, experiences: [personal], savedIds: ['market'] };
  const next = startProfile(data, ' 민서 ', true);
  assert.ok(next.experiences.some((e) => e.id === personal.id));
  assert.deepEqual(next.savedIds, ['market']);
  assert.equal(next.nickname, '민서');
  assert.equal(next.demo, true);
});
test('repeated demo start does not duplicate or overwrite edited records', () => {
  const edited = { ...demoExperiences[0], goodReason: '수정된 기억' };
  const data = { ...initialData, experiences: [edited, demoExperiences[1]] };
  const next = startProfile(data, '민서', true);
  assert.equal(next.experiences.length, 2);
  assert.equal(next.experiences[0].goodReason, '수정된 기억');
});
test('normal start keeps demo provenance when demo records remain', () => {
  const next = startProfile({ ...initialData, experiences: demoExperiences }, '민서', false);
  assert.equal(next.demo, true);
});
test('empty history is neutral and finite', () => {
  const dna = calculateDNA([]);
  assert.equal(dna.evidenceCount, 0);
  assert.ok(
    rankPlaces(dna, seoul).every((r) => r.score === 50 && r.matchedAttributes.length === 0),
  );
});
test('changing travel preferences changes actual recommendation order', () => {
  const walk = rankPlaces(calculateDNA([record(['walk', 'quiet', 'architecture'])]), seoul);
  const food = rankPlaces(calculateDNA([record(['food', 'local'])]), seoul);
  assert.notEqual(walk[0].placeId, food[0].placeId);
  assert.equal(food[0].placeId, 'market');
});
test('crowd aversion reduces market score using exactly the documented formula', () => {
  const score = (dislikes: Conflict[]) =>
    rankPlaces(calculateDNA([record(['food'], dislikes)]), seoul).find(
      (r) => r.placeId === 'market',
    )!.score;
  assert.equal(score([]), 100);
  assert.equal(score(['crowds']), 65);
});
test('duplicate tags cannot multiply the same experience evidence', () => {
  assert.deepEqual(
    calculateDNA([record(['walk', 'walk'])]).preferences,
    calculateDNA([record(['walk'])]).preferences,
  );
});
test('satisfaction affects relative preference weights across records', () => {
  const dna = calculateDNA([
    record(['nature'], [], 5),
    { ...record(['food'], [], 1), id: 'second' },
  ]);
  assert.equal(dna.preferences.nature, 1);
  assert.equal(dna.preferences.food, 0.2);
});
test('explanations reference only contributing dataset and profile attributes', () => {
  const dna = calculateDNA(demoExperiences);
  for (const r of rankPlaces(dna, places)) {
    const p = places.find((p) => p.id === r.placeId)!;
    for (const k of r.matchedAttributes)
      assert.ok(dna.preferences[k] > 0 && (p.positiveAttributes[k] ?? 0) >= 0.4);
    for (const k of r.conflictingAttributes)
      assert.ok(dna.aversions[k] > 0 && (p.negativeAttributes[k] ?? 0) >= 0.3);
    assert.ok(r.score >= 0 && r.score <= 100);
  }
});
test('service interface returns deterministic results', async () => {
  const dna = calculateDNA(demoExperiences);
  assert.deepEqual(
    await new LocalRecommendationService().recommend(dna, seoul),
    rankPlaces(dna, [...seoul].reverse()),
  );
});
test('all IDs unique and every location belongs to its designated city', () => {
  assert.equal(new Set(places.map((p) => p.id)).size, places.length);
  for (const p of places) {
    if (p.region === 'seoul')
      assert.ok(
        p.latitude > 37.4 && p.latitude < 37.7 && p.longitude > 126.8 && p.longitude < 127.2,
      );
    else
      assert.ok(p.latitude > 35 && p.latitude < 35.3 && p.longitude > 128.9 && p.longitude < 129.3);
  }
});
test('storage roundtrip preserves experience and saved place data', () => {
  const data = {
    ...initialData,
    nickname: '민서',
    onboarded: true,
    experiences: demoExperiences,
    savedIds: ['seochon', 'forest'],
  };
  assert.deepEqual(decodeData(JSON.stringify(data)), data);
});
test('corrupt storage is rejected rather than silently replaced', () => {
  assert.throws(() => decodeData('{broken'));
  assert.throws(() =>
    decodeData(
      JSON.stringify({ ...initialData, experiences: [{ ...demoExperiences[0], rating: 9 }] }),
    ),
  );
  assert.throws(() =>
    decodeData(
      JSON.stringify({ ...initialData, experiences: [demoExperiences[0], demoExperiences[0]] }),
    ),
  );
});
test('data adapter accepts valid JSON and rejects malformed intensities and IDs', () => {
  assert.deepEqual(adaptPlaceRows(JSON.parse(JSON.stringify(places))), places);
  assert.throws(() => adaptPlaceRows([{ ...places[0], positiveAttributes: { walk: 3 } }]));
  assert.throws(() => adaptPlaceRows([places[0], places[0]]));
  assert.throws(() => adaptPlaceRows([{ ...places[0], latitude: NaN }]));
});

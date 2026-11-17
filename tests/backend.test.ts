import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { adaptShortlist } from '../src/services/backend/client.ts';

test('real shortlist adapter rejects missing coordinates, non-Seoul and duplicates without inventing scores', () => {
  const valid = {
    name: '장소',
    place_id: '1',
    source: 'places',
    lat: 37.55,
    lng: 126.98,
    score: 999,
    address: '서울',
    source_keyword: '카페',
  };
  const result = adaptShortlist({
    shortlist: [
      valid,
      valid,
      { ...valid, place_id: '2', lat: null },
      { ...valid, place_id: '3', lat: 35 },
    ],
  });
  assert.equal(result.places.length, 1);
  assert.equal(result.recommendations[0].score, null);
  assert.equal(result.places[0].image, '');
  assert.deepEqual(adaptShortlist({ shortlist: [] }).places, []);
  assert.throws(() => adaptShortlist({ places: [] }));
});

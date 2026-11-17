import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createItinerary } from '../src/services/itinerary/index.ts';
import { places } from '../src/data/mock/places.ts';

test('three-day grouping is deterministic, unique and excludes other cities', () => {
  const result = createItinerary([...places, places[0]]);
  assert.equal(result.length, 3);
  assert.deepEqual(result, createItinerary([...places, places[0]]));
  const flat = result.flat();
  assert.equal(new Set(flat.map((p) => p.id)).size, flat.length);
  assert.ok(flat.every((p) => p.region === 'seoul'));
  assert.deepEqual(createItinerary([]), [[], [], []]);
});

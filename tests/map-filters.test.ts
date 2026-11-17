import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptShortlist } from '../src/services/backend/client.ts';
import { filterItinerary, matchesMapFilter } from '../src/features/recommendations/mapFilters.ts';
test('API filters use returned category instead of nonexistent attribute scores', () => {
  const place = adaptShortlist({
    shortlist: [
      {
        name: '현지 건축',
        place_id: '1',
        source: 'tourapi',
        source_keyword: '박물관',
        lat: 37.5,
        lng: 127,
      },
    ],
  }).places[0];
  assert.equal(matchesMapFilter(place, 'culture'), true);
  assert.equal(matchesMapFilter(place, 'architecture'), false);
});

test('filtering and saved-only retain original days and visit order, including empty days', () => {
  const places = adaptShortlist({
    shortlist: [
      ['a', '박물관'],
      ['b', '식당'],
      ['c', '미술관'],
      ['d', '식당'],
    ].map(([id, category], i) => ({
      name: id,
      place_id: id,
      source: 'kakao',
      source_keyword: category,
      lat: 37.5 + i * 0.01,
      lng: 127,
    })),
  }).places;
  const itinerary = [[places[0], places[1]], [places[3]], [places[2]]];
  const ids = (days: typeof itinerary) => days.map((day) => day.map((p) => p.externalId));
  assert.deepEqual(ids(filterItinerary(itinerary, 'culture', false, [])), [['a'], [], ['c']]);
  assert.deepEqual(ids(filterItinerary(itinerary, null, false, [places[0].id])), [
    ['a', 'b'],
    ['d'],
    ['c'],
  ]);
  assert.deepEqual(ids(filterItinerary(itinerary, null, true, [places[2].id])), [[], [], ['c']]);
  assert.deepEqual(ids(itinerary), [['a', 'b'], ['d'], ['c']]);
});

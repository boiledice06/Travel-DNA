import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptShortlist } from '../src/services/backend/client.ts';
import { matchesMapFilter } from '../src/features/recommendations/mapFilters.ts';
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

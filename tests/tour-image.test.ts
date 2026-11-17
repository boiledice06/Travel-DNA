import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptShortlist } from '../src/services/backend/client.ts';
import { validateSavedPlaces } from '../src/services/recommendation/api.ts';
test('official image passes through shortlist and saved snapshot; other hosts are rejected', () => {
  const row = {
    name: 'Place',
    place_id: '1',
    source: 'tourapi',
    lat: 37.5,
    lng: 127,
    image_url: 'https://tong.visitkorea.or.kr/photo.jpg',
  };
  const result = adaptShortlist({ shortlist: [row] });
  assert.equal(result.places[0].image, row.image_url);
  assert.equal(
    validateSavedPlaces([{ place: result.places[0], recommendation: result.recommendations[0] }])
      .length,
    1,
  );
  assert.equal(
    adaptShortlist({ shortlist: [{ ...row, image_url: 'https://evil.example/photo.jpg' }] })
      .places[0].image,
    '',
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { adaptShortlist } from '../src/services/backend/client.ts';
import {
  decodePlacePhoto,
  decodePlacePhotos,
  withPlacePhotos,
} from '../src/services/backend/photos.ts';
import { validateSavedPlaces } from '../src/services/recommendation/api.ts';

const result = adaptShortlist({
  shortlist: [
    { name: '서울 역사박물관', place_id: 'one', source: 'kakao', lat: 37.57, lng: 126.97 },
    { name: '다른 장소', place_id: 'two', source: 'kakao', lat: 37.56, lng: 126.98 },
  ],
});
const image = {
  provider: 'commons',
  url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/file.jpg',
  source_page: 'https://commons.wikimedia.org/wiki/File:History.jpg',
  publisher: 'Wikimedia Commons',
  author: 'Photographer',
  license: 'CC BY-SA 3.0',
  license_url: 'https://creativecommons.org/licenses/by-sa/3.0/',
  can_modify: true,
  match: ['exact place'],
  description: '',
  attribution: '',
};

test('attach only requested verified photos without changing order or legacy result', () => {
  const [place] = result.places;
  const photos = decodePlacePhotos(
    [
      { id: place.id, photo: image },
      { id: 'unrequested', photo: image },
    ],
    result.places,
  );
  const enriched = withPlacePhotos(result.places, photos);
  assert.deepEqual(
    enriched.map((p) => p.id),
    result.places.map((p) => p.id),
  );
  assert.deepEqual(enriched[0].photo, image);
  assert.equal(enriched[1], result.places[1]);
  assert.equal(place.photo, undefined);
  assert.equal(
    validateSavedPlaces([{ place: enriched[0], recommendation: result.recommendations[0] }])[0]
      .place.photo?.author,
    image.author,
  );
});

test('reject untrusted media, missing author, or prohibited modification flags', () => {
  assert.equal(
    decodePlacePhoto({ ...image, url: 'https://untrusted.example/photo.jpg' }),
    undefined,
  );
  assert.equal(decodePlacePhoto({ ...image, author: null }), undefined);
  assert.equal(
    decodePlacePhoto({
      ...image,
      provider: 'tourapi',
      url: 'https://tong.visitkorea.or.kr/image.jpg',
      source_page: 'https://www.data.go.kr/data/15101578/openapi.do',
      license: 'KOGL-3',
      license_url: 'https://www.kogl.or.kr/info/license.do',
      can_modify: true,
    }),
    undefined,
  );
});

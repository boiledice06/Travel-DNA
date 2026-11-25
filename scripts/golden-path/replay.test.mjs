import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { createReplay, loadMedia } from './replay.mjs';
import { fixtureDir } from './runtime.mjs';

const recording = JSON.parse(await readFile(join(fixtureDir, 'recording.json'), 'utf8'));
const flow = recording.calls.filter(
  (call) => call.method === 'POST' && call.path !== '/api/place-photos',
);
const replay = createReplay(recording, { recommendationDelay: 0 });
const photos = recording.calls.find((call) => call.path === '/api/place-photos');

test('replays one recorded trip deterministically with independent request cursors', () => {
  for (const state of [replay.start(), replay.start()]) {
    assert.equal(
      replay.use(state, 'POST', photos.path, photos.request).body.detail.code,
      'demo_step_order',
    );
    assert.equal(replay.use(state, 'POST', flow[2].path, flow[2].request).status, 409);
    for (const call of flow) {
      const first = replay.use(state, 'POST', call.path, call.request);
      const duplicate = replay.use(state, 'POST', call.path, call.request);
      assert.equal(first.status, 200);
      assert.deepEqual(first.body, call.response);
      assert.deepEqual(duplicate.body, call.response);
    }
    const [place] = photos.request.places;
    assert.deepEqual(replay.use(state, 'POST', photos.path, { places: [place] }).body, [
      photos.response[0],
    ]);
    assert.equal(
      replay.use(state, 'POST', photos.path, { places: [{ ...place, latitude: 0 }] }).status,
      409,
    );
    assert.equal(replay.use(state, 'POST', photos.path, { places: [place, place] }).status, 409);
  }
});
test('does not consume a step when the traveler inputs different conditions', () => {
  const state = replay.start();
  const profile = flow[0];
  assert.equal(
    replay.use(state, 'POST', profile.path, { ...profile.request, party_size: '1' }).body.detail
      .code,
    'demo_scenario_mismatch',
  );
  assert.deepEqual(replay.use(state, 'POST', profile.path, profile.request).body, profile.response);
  assert.equal(replay.use(state, 'GET', '/api/dna-chat/golden-session', null).status, 409);
  assert.equal(replay.use(state, 'POST', '/api/unknown', {}).status, 404);
});
test('checks original photograph bytes against the approved fixture and manifests', async () => {
  const media = await loadMedia(fixtureDir, replay.healthyPhotos);
  assert.deepEqual(media.unavailable, []);
  assert.equal(media.files.size, recording.summary.verifiedPhotos);
  assert.equal(Object.keys(media.mapping).length, recording.summary.verifiedPhotos);
});

import assert from 'node:assert/strict';
import { BackendClient } from '../src/services/backend/client.ts';
import { createItinerary } from '../src/services/itinerary/index.ts';
const client = new BackendClient('http://127.0.0.1:18767', 10000);
const profile = await client.createProfile({
  party_size: '2',
  companion_type: 'friends',
  duration: '2n3d',
  transport: 'walk_subway',
  budget_level: 'mid',
  time_window: 'morning',
});
const start = await client.start();
const survey = await client.likert(
  start.session_id,
  start.likert_items.map((item) => ({ id: item.id, value: 3 })),
);
assert.equal(survey.phase, 'asking');
const chat = await client.message(start.session_id, '조용한 카페');
assert.equal(chat.phase, 'constraints');
assert.equal((await client.constraints(start.session_id, '카페', '클럽')).phase, 'draft');
await client.finalize(start.session_id);
const result = await client.find(profile.id, start.session_id);
const days = createItinerary(result.places);
assert.ok(result.places.length >= 3);
assert.equal(new Set(days.flat().map((p) => p.id)).size, days.flat().length);
assert.ok(days.every((day) => day.length));
assert.ok(days.flat().every((p) => result.recommendations.some((r) => r.placeId === p.id)));
console.log(
  `PASS mock HTTP flow: ${result.places.length} candidate markers, ${days.map((d) => d.length).join('/')} days`,
);

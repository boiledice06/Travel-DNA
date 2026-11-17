import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { BackendClient } from '../src/services/backend/client.ts';
import { createItinerary } from '../src/services/itinerary/index.ts';

test('mock server: 3-day profile, survey, chat, constraints, confirmation, shortlist and map inputs', async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  let submittedDuration = '';
  globalThis.fetch = async (url, init) => {
    const path = new URL(String(url)).pathname;
    const body = JSON.parse(String(init?.body ?? '{}'));
    calls.push(path);
    let result: unknown;
    const base = { session_id: 'session', turn: 0, assistant_message: '질문', chips: ['선택지'] };
    switch (path) {
      case '/api/trip-profile':
        submittedDuration = body.duration;
        result = { id: 'profile' };
        break;
      case '/api/dna-chat/start':
        result = {
          ...base,
          phase: 'likert',
          likert_items: [
            {
              id: 'q1',
              statement_ko: '질문 1',
              scale: [1, 2, 3, 4, 5].map((value) => ({ value, label_ko: String(value) })),
            },
          ],
        };
        break;
      case '/api/dna-chat/likert':
        assert.equal(body.answers[0].value, 4);
        result = { ...base, phase: 'asking' };
        break;
      case '/api/dna-chat/message':
        assert.equal(body.message, '선택지');
        result = { ...base, phase: 'constraints', turn: 1 };
        break;
      case '/api/dna-chat/constraints':
        assert.equal(body.must_avoid, '혼잡');
        result = { ...base, phase: 'draft', turn: 1 };
        break;
      case '/api/dna-chat/finalize':
        result = { session_id: 'session', phase: 'confirmed' };
        break;
      case '/api/seoul-find':
        assert.equal(body.profile_id, 'profile');
        assert.equal(body.dna_session_id, 'session');
        result = {
          shortlist: Array.from({ length: 9 }, (_, i) => ({
            name: `장소 ${i}`,
            place_id: String(i),
            source: 'mock',
            source_keyword: '카페',
            lat: 37.5 + i * 0.01,
            lng: 126.9 + i * 0.01,
          })),
        };
        break;
      default:
        return new Response('{}', { status: 404 });
    }
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const client = new BackendClient('http://mock');
    const profile = await client.createProfile({
      party_size: '2',
      companion_type: 'friends',
      duration: '2n3d',
      transport: 'walk_subway',
      budget_level: 'mid',
      time_window: 'morning',
    });
    const start = await client.start();
    assert.equal((await client.likert(start.session_id, [{ id: 'q1', value: 4 }])).phase, 'asking');
    assert.equal((await client.message(start.session_id, '선택지')).phase, 'constraints');
    assert.equal((await client.constraints(start.session_id, '카페', '혼잡')).phase, 'draft');
    await client.finalize(start.session_id);
    const result = await client.find(profile.id, start.session_id);
    const days = createItinerary(result.places);
    assert.equal(submittedDuration, '2n3d');
    assert.equal(days.length, 3);
    assert.equal(days.flat().length, 9);
    assert.equal(new Set(days.flat().map((p) => p.id)).size, 9);
    assert.ok(days.every((day) => day.length > 0));
    assert.ok(
      days
        .flat()
        .every((p) => result.recommendations.some((r) => r.placeId === p.id && r.score === null)),
    );
    assert.deepEqual(calls, [
      '/api/trip-profile',
      '/api/dna-chat/start',
      '/api/dna-chat/likert',
      '/api/dna-chat/message',
      '/api/dna-chat/constraints',
      '/api/dna-chat/finalize',
      '/api/seoul-find',
    ]);
  } finally {
    globalThis.fetch = original;
  }
});

test('backend client handles invalid JSON, expired sessions and connection failures', async () => {
  const original = globalThis.fetch;
  const client = new BackendClient('http://mock');
  try {
    globalThis.fetch = async () => new Response('{', { status: 200 });
    await assert.rejects(client.start(), /JSON/);
    globalThis.fetch = async () => new Response('{}', { status: 404 });
    await assert.rejects(client.getSession('expired'), /세션/);
    globalThis.fetch = async () => {
      throw new TypeError('offline');
    };
    await assert.rejects(client.start(), /연결/);
  } finally {
    globalThis.fetch = original;
  }
});
test('backend client reports delayed requests and unavailable upstream services', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    await assert.rejects(new BackendClient('http://mock', 5).start(), /초과/);
    globalThis.fetch = async () => new Response('{}', { status: 503 });
    await assert.rejects(new BackendClient('http://mock').start(), /외부 서비스/);
  } finally {
    globalThis.fetch = original;
  }
});

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
const equal = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
const problem = (code, status = 409) => ({ status, body: { detail: { code } } });
const success = (body, delay = 0) => ({ status: 200, body, delay });
const startPaths = ['/api/trip-profile', '/api/dna-chat/start', '/api/dna-chat/likert'];
const endPaths = ['/api/dna-chat/constraints', '/api/dna-chat/finalize', '/api/seoul-find'];

export function createReplay(record, { recommendationDelay = 920 } = {}) {
  if (
    record.version !== 1 ||
    !Array.isArray(record.calls) ||
    record.calls.some((call) => call.status !== 200)
  )
    throw Error('The actual API recording is incomplete.');
  const flow = record.calls.filter(
    (call) => call.method === 'POST' && call.path !== '/api/place-photos',
  );
  const pathNames = flow.map((call) => call.path);
  const messages = pathNames.slice(3, -3);
  if (
    !equal(pathNames.slice(0, 3), startPaths) ||
    !equal(pathNames.slice(-3), endPaths) ||
    !messages.length ||
    messages.some((path) => path !== '/api/dna-chat/message')
  )
    throw Error('The recording does not contain the full trip flow.');
  const summary = record.calls.find(
    (call) => call.method === 'GET' && call.path === '/api/dna-chat/golden-session',
  );
  const photos = new Map();
  for (const batch of record.calls.filter((call) => call.path === '/api/place-photos')) {
    for (const item of batch.request.places) {
      const recorded = batch.response.find((row) => row.id === item.id);
      if (!recorded || photos.has(item.id)) throw Error('Invalid recorded photo batch');
      photos.set(item.id, { item, recorded });
    }
  }
  const find = flow.at(-1);
  const ids = find.response.shortlist.map(
    (row) => 'api:' + encodeURIComponent(row.source) + ':' + encodeURIComponent(row.place_id),
  );
  if (
    !summary ||
    summary.response.phase !== 'confirmed' ||
    ids.length !== photos.size ||
    !ids.every((id) => photos.has(id))
  )
    throw Error('The recorded session or photo results are incomplete.');
  const healthyPhotos = [...photos.values()].map(({ recorded }) => recorded.photo).filter(Boolean);
  return {
    healthyPhotos,
    start: () => ({ cursor: 0 }),
    use(state, method, path, body) {
      if (method === 'GET' && path === summary.path)
        return state.cursor >= flow.length - 1
          ? success(summary.response)
          : problem('demo_step_order');
      if (method !== 'POST') return problem('demo_endpoint_unavailable', 404);
      if (path === '/api/place-photos') {
        if (state.cursor !== flow.length) return problem('demo_step_order');
        if (
          !body ||
          !equal(Object.keys(body), ['places']) ||
          !Array.isArray(body.places) ||
          body.places.length < 1 ||
          body.places.length > 4 ||
          new Set(body.places.map((item) => item?.id)).size !== body.places.length ||
          !body.places.every((item) => equal(item, photos.get(item?.id)?.item))
        )
          return problem('demo_scenario_mismatch');
        return success(body.places.map((item) => photos.get(item.id).recorded));
      }
      const previous = flow[state.cursor - 1];
      const current = flow[state.cursor];
      if (current?.path === path && equal(current.request, body)) {
        state.cursor++;
        return success(
          current.response,
          path === find.path ? recommendationDelay : path.endsWith('/message') ? 320 : 0,
        );
      }
      if (previous?.path === path && equal(previous.request, body))
        return success(previous.response, path === find.path ? recommendationDelay : 0);
      if (current?.path === path || previous?.path === path)
        return problem('demo_scenario_mismatch');
      if (pathNames.includes(path)) return problem('demo_step_order');
      return problem('demo_endpoint_unavailable', 404);
    },
  };
}

export async function loadMedia(fixtureDir, photos, manifest = 'media.json') {
  const index = JSON.parse(await readFile(join(fixtureDir, manifest), 'utf8'));
  const mapping = {};
  const files = new Map();
  const unavailable = [];
  for (const url of new Set(photos.map((photo) => photo.url))) {
    const item = index[url];
    const kinds = { bmp: 'image/bmp', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    const parts =
      typeof item?.file === 'string' && /^([a-f0-9]{64})\.(bmp|jpg|png|webp)$/.exec(item.file);
    if (!parts || parts[1] !== item.sha256 || kinds[parts[2]] !== item.contentType)
      throw Error('Invalid presentation photo manifest.');
    const bytes = await readFile(join(fixtureDir, 'assets', item.file)).catch(() => null);
    if (
      !bytes ||
      bytes.length !== item.size ||
      createHash('sha256').update(bytes).digest('hex') !== item.sha256
    ) {
      unavailable.push(item.file);
      continue;
    }
    const route = '/demo-assets/' + item.file;
    mapping[url] = route;
    files.set(route, { bytes, type: item.contentType });
  }
  return { mapping, files, unavailable };
}

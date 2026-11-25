import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { createReplay, loadMedia } from './replay.mjs';
import { build, fixtureDir, getEpoch, origin, root } from './runtime.mjs';

const local = new URL(origin);
const record = JSON.parse(await readFile(join(fixtureDir, 'recording.json'), 'utf8'));
const replay = createReplay(record);
const media = await loadMedia(fixtureDir, replay.healthyPhotos);
const contentTypes = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
};
const sessions = new Map();
let epoch = await getEpoch();

async function refreshEpoch() {
  const next = await getEpoch();
  if (next !== epoch) {
    epoch = next;
    sessions.clear();
  }
}
async function buildPresentation() {
  const cli = join(root, 'node_modules', 'expo', 'bin', 'cli');
  await new Promise((done, fail) => {
    const child = spawn(
      process.execPath,
      [cli, 'export', '--platform', 'web', '--output-dir', build],
      {
        cwd: root,
        stdio: 'inherit',
        env: {
          ...process.env,
          EXPO_OFFLINE: '1',
          EXPO_NO_DOTENV: '1',
          EXPO_PUBLIC_TRAVEL_PRESENTATION: '1',
          EXPO_PUBLIC_RECOMMENDATION_SERVER_URL: origin,
        },
      },
    );
    child.once('error', fail);
    child.once('exit', (code) => (code === 0 ? done() : fail(Error('Expo Web export failed'))));
  });
}
if (!process.argv.includes('--serve-only')) await buildPresentation();
const index = await readFile(join(build, 'index.html'), 'utf8');

async function jsonBody(req) {
  if (!String(req.headers['content-type'] ?? '').startsWith('application/json'))
    throw Error('Invalid content type');
  const parts = [];
  let length = 0;
  for await (const packet of req) {
    length += packet.length;
    if (length > 32000) throw Error('Request is too large');
    parts.push(packet);
  }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
function sessionFor(req, res) {
  const key = req.headers.cookie?.match(/(?:^|;\s*)travel_demo=([a-f\d-]{36})(?:;|$)/)?.[1];
  if (key && sessions.has(key)) return sessions.get(key);
  const state = replay.start();
  const id = randomUUID();
  if (sessions.size >= 128) sessions.delete(sessions.keys().next().value);
  sessions.set(id, state);
  res.setHeader('Set-Cookie', `travel_demo=${id}; Path=/; HttpOnly; SameSite=Strict`);
  return state;
}
function reply(res, status, body, type = 'application/json; charset=utf-8') {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.end(Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body));
}
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tile.openstreetmap.org; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
  );
  if (req.headers.host !== local.host || (req.headers.origin && req.headers.origin !== origin))
    return reply(res, 403, { detail: { code: 'demo_local_only' } });
  try {
    await refreshEpoch();
    const pathname = decodeURIComponent(new URL(req.url, origin).pathname);
    if (pathname === '/api/demo/health' && req.method === 'GET')
      return reply(res, media.unavailable.length ? 503 : 200, {
        mode: 'recorded-presentation',
        epoch,
        fixtureReady: true,
        assetsReady: media.unavailable.length === 0,
        photos: media.files.size,
        unavailable: media.unavailable.length,
      });
    if (pathname.startsWith('/api/')) {
      const state = sessionFor(req, res);
      let input = null;
      if (req.method === 'POST') {
        try {
          input = await jsonBody(req);
        } catch {
          return reply(res, 400, { detail: { code: 'demo_invalid_body' } });
        }
      }
      const result = replay.use(state, req.method, pathname, input);
      if (result.delay) await new Promise((done) => setTimeout(done, result.delay));
      return reply(res, result.status, result.body);
    }
    if (req.method !== 'GET') return reply(res, 405, { detail: { code: 'demo_invalid_method' } });
    if (pathname.startsWith('/demo-assets/')) {
      const asset = media.files.get(pathname);
      if (!asset) return reply(res, 404, { detail: { code: 'demo_photo_missing' } });
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return reply(res, 200, asset.bytes, asset.type);
    }
    const file = resolve(build, '.' + pathname);
    const suffix = relative(build, file);
    if (
      suffix &&
      !suffix.startsWith('..') &&
      (await stat(file).catch(() => null))?.isFile() &&
      file !== join(build, 'index.html')
    ) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return reply(
        res,
        200,
        await readFile(file),
        contentTypes[extname(file)] || 'application/octet-stream',
      );
    }
    if (pathname.startsWith('/_expo/') || pathname.startsWith('/assets/'))
      return reply(res, 404, { detail: { code: 'demo_static_missing' } });
    const data = JSON.stringify({ epoch, photos: media.mapping }).replaceAll('<', '\\u003c');
    return reply(
      res,
      200,
      index.replace('<head>', '<head><script>window.__TRAVEL_DNA_DEMO__=' + data + '</script>'),
      contentTypes['.html'],
    );
  } catch {
    return reply(res, 500, { detail: { code: 'demo_server_failure' } });
  }
});
server.on('error', (error) => {
  console.error('발표 서버 실행 실패 (' + error.code + ')');
  process.exitCode = 1;
});
server.listen(Number(local.port), local.hostname, () => {
  console.log('Travel DNA 발표 모드 · 실제 추천 기록 재생');
  console.log(origin);
  console.log(
    `사진 ${media.files.size}개 확인 · 누락 ${media.unavailable.length}개 · npm run demo:reset 으로 초기화`,
  );
});

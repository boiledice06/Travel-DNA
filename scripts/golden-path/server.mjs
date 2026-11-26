import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { createReplay, loadMedia } from './replay.mjs';
import { build, fixtureDir, getEpoch, origin, root } from './runtime.mjs';

const local = new URL(origin);
const protocol = 'travel-dna-presentation-v2';
const scenarios = new Map();
for (const [id, suffix, label] of [
  ['a', '-a', 'A. 활기찬 체험형'],
  ['b', '', 'B. 조용한 휴식형'],
]) {
  const record = JSON.parse(
    await readFile(join(fixtureDir, 'recording' + suffix + '.json'), 'utf8'),
  );
  const replay = createReplay(record);
  const media = await loadMedia(fixtureDir, replay.healthyPhotos, 'media' + suffix + '.json');
  scenarios.set(id, { id, label, replay, media, sessions: new Map() });
}
const files = new Map([...scenarios.values()].flatMap(({ media }) => [...media.files]));
const launcher = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Travel DNA 발표 모드</title>
<style>
body{min-height:100vh;margin:0;display:grid;place-items:center;background:#102631;color:#fff;font:1rem system-ui,sans-serif}
main{width:min(24rem,calc(100% - 3rem))}
p{color:#bce2d7}
a{display:block;margin:.75rem 0;padding:1rem;border-radius:1rem;background:#bce2d7;color:#102631;font-weight:700;text-decoration:none}
</style></head><body><main><p>Travel DNA · 서울 2박 3일</p><h1>발표 시나리오 선택</h1>
<a href="/?scenario=a">A. 활기찬 체험형</a>
<a href="/?scenario=b">B. 조용한 휴식형</a>
</main></body></html>`;
const contentTypes = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
};
let epoch = await getEpoch();

async function refreshEpoch() {
  const next = await getEpoch();
  if (next !== epoch) {
    epoch = next;
    for (const { sessions } of scenarios.values()) sessions.clear();
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
const head = /<head(?:\s[^>]*)?>/i;
const entryScripts = [
  ...index.matchAll(/<script\b[^>]*\bsrc=["'](\/_expo\/static\/js\/web\/[\w.-]+\.js)["']/gi),
];
const startupSources = await Promise.all(
  entryScripts.map(([, href]) => readFile(join(build, href.slice(1)))),
);
if (!head.test(index) || !startupSources.some((bytes) => bytes.includes(protocol)))
  throw Error('발표 런타임과 호환되지 않는 Expo 빌드입니다. npm run demo로 다시 빌드하세요.');
const fingerprint = createHash('sha256');
for (const bytes of startupSources) fingerprint.update(bytes);
const bundle = fingerprint.digest('hex').slice(0, 12);

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
function sessionFor(req, res, { id: scenario, replay, sessions }) {
  const name = scenario === 'a' ? 'travel_demo_a' : 'travel_demo';
  const cookie = req.headers.cookie
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(name + '='));
  const key = cookie?.slice(name.length + 1);
  if (sessions.has(key)) return sessions.get(key);
  const state = replay.start();
  const id = randomUUID();
  if (sessions.size >= 128) sessions.delete(sessions.keys().next().value);
  sessions.set(id, state);
  const path = scenario === 'a' ? '/demo-api/a/api' : '/api';
  res.setHeader('Set-Cookie', `${name}=${id}; Path=${path}; HttpOnly; SameSite=Strict`);
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
    const url = new URL(req.url, origin);
    const pathname = decodeURIComponent(url.pathname);
    if (
      pathname === '/' &&
      !['a', 'b'].includes(url.searchParams.get('scenario')) &&
      req.method === 'GET'
    ) {
      res.setHeader('Location', '/demo');
      return reply(res, 302, '', contentTypes['.html']);
    }
    if (pathname === '/demo' && req.method === 'GET')
      return reply(res, 200, launcher, contentTypes['.html']);
    const aRequest = pathname.startsWith('/demo-api/a/api/');
    const apiPath = aRequest ? pathname.slice('/demo-api/a'.length) : pathname;
    const { media, replay } = scenarios.get(aRequest ? 'a' : 'b');
    if (apiPath === '/api/demo/health' && req.method === 'GET')
      return reply(res, media.unavailable.length ? 503 : 200, {
        mode: 'recorded-presentation',
        protocol,
        bundle,
        epoch,
        fixtureReady: true,
        assetsReady: media.unavailable.length === 0,
        photos: media.files.size,
        unavailable: media.unavailable.length,
      });
    if (apiPath.startsWith('/api/')) {
      const state = sessionFor(req, res, scenarios.get(aRequest ? 'a' : 'b'));
      let input = null;
      if (req.method === 'POST') {
        try {
          input = await jsonBody(req);
        } catch {
          return reply(res, 400, { detail: { code: 'demo_invalid_body' } });
        }
      }
      const result = replay.use(state, req.method, apiPath, input);
      if (result.delay) await new Promise((done) => setTimeout(done, result.delay));
      return reply(res, result.status, result.body);
    }
    if (req.method !== 'GET') return reply(res, 405, { detail: { code: 'demo_invalid_method' } });
    if (pathname.startsWith('/demo-assets/')) {
      const asset = files.get(pathname);
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
      return reply(
        res,
        200,
        await readFile(file),
        contentTypes[extname(file)] || 'application/octet-stream',
      );
    }
    if (pathname.startsWith('/_expo/') || pathname.startsWith('/assets/'))
      return reply(res, 404, { detail: { code: 'demo_static_missing' } });
    const photos = Object.fromEntries(
      [...scenarios.values()].map(({ id, media }) => [id, media.mapping]),
    );
    const data = JSON.stringify({ protocol, epoch, bundle, photos }).replaceAll('<', '\\u003c');
    const bootstrap = `(() => {
      const key = 'travel-dna/demo-scenario';
      const selected = new URLSearchParams(location.search).get('scenario');
      let scenario = selected;
      try {
        if (selected === 'a' || selected === 'b') sessionStorage.setItem(key, selected);
        else if (selected === null) scenario = sessionStorage.getItem(key);
      } catch {}
      const data = ${data};
      if (scenario === 'a' || scenario === 'b') {
        window.__TRAVEL_DNA_DEMO__ = {
          protocol: data.protocol, epoch: data.epoch, bundle: data.bundle,
          scenario, photos: data.photos[scenario]
        };
      }
    })();`;
    return reply(
      res,
      200,
      index.replace(
        head,
        (tag) =>
          tag +
          '<meta name="travel-dna-presentation" content="' +
          protocol +
          '">' +
          '<script id="travel-dna-bootstrap">' +
          bootstrap +
          '</script>',
      ),
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
  console.log(origin + ' · 번들 ' + bundle);
  for (const { label, media } of scenarios.values())
    console.log(`${label} · 사진 ${media.files.size}개 확인 · 누락 ${media.unavailable.length}개`);
});

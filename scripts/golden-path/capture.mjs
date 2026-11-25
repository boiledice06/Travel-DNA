import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { adaptShortlist } from '../../src/services/backend/client.ts';
import { createItinerary } from '../../src/services/itinerary/index.ts';
import { fixtureDir, getEpoch, origin, reset, root, workspace } from './runtime.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.TRAVEL_PLAYWRIGHT ?? 'playwright');
const flag = (name) => process.argv.includes('--' + name);
const runs = Number(process.argv.find((arg) => arg.startsWith('--runs='))?.slice(7) ?? 1);
const offline = flag('offline');
const scenario = process.argv.find((arg) => arg.startsWith('--scenario='))?.slice(11) ?? 'b';
assert(scenario === 'a' || scenario === 'b', 'Use --scenario=a or --scenario=b');
const prefix = (id) => (id === 'a' ? '/demo-api/a' : '');
const api = (path) => prefix(scenario) + path;
const suffix = scenario === 'a' ? '-a' : '';
const labels = { a: 'A. 활기찬 체험형', b: 'B. 조용한 휴식형' };
const other = scenario === 'a' ? 'b' : 'a';
const film = flag('film') ? 'full-demo' : flag('highlights') ? 'highlights' : '';
assert(Number.isInteger(runs) && runs > 0 && runs <= 10);
assert(!film || (runs === 1 && !offline), 'Film each video in one online run');
const final = join(root, 'presentation', 'final');
const shots = join(final, 'screenshots', ...(suffix ? ['a'] : []));
const evidence = flag('no-screenshots') ? workspace : join(final, 'verification');
const reportName =
  film ||
  (offline
    ? 'offline'
    : flag('diagnostic')
      ? 'diagnostic'
      : runs === 1
        ? 'capture'
        : 'repetitions');
for (const dir of [shots, evidence, join(final, 'videos'), workspace])
  await mkdir(dir, { recursive: true });

const record = JSON.parse(await readFile(join(fixtureDir, 'recording' + suffix + '.json'), 'utf8'));
const endpoint = (path) => record.calls.find((call) => call.path === path);
const messages = record.calls.filter((call) => call.path === '/api/dna-chat/message');
const expectedPhotos = new Map(
  record.calls
    .filter((call) => call.path === '/api/place-photos')
    .flatMap((call) => call.response.map((row) => [row.id, row.photo])),
);
const candidates = adaptShortlist(endpoint('/api/seoul-find').response).places;
const itinerary = createItinerary(candidates);
const reference =
  itinerary[2].find((place) => expectedPhotos.get(place.id)?.can_modify) ??
  itinerary[2].find((place) => expectedPhotos.get(place.id));
assert(reference, 'Day 3 has no verified photograph');

async function ready(epoch) {
  const response = await fetch(origin + api('/api/demo/health'), {
    signal: AbortSignal.timeout(4500),
  });
  assert(response.ok, 'Start npm run demo and wait for photograph verification');
  const data = await response.json();
  assert.equal(data.mode, 'recorded-presentation');
  assert.equal(data.epoch, epoch);
  assert.equal(data.photos, record.summary.verifiedPhotos);
  assert(data.fixtureReady && data.assetsReady);
  return data;
}
await ready(await getEpoch());
const browser = await chromium.launch({ channel: process.env.TRAVEL_BROWSER ?? 'msedge' });
const results = [];
let activePage;
let context;
let step = 'preflight';
const pause = (ms) => activePage.waitForTimeout(ms);

async function run(index, result) {
  const epoch = await reset();
  const startup = await ready(epoch);
  const raw = join(workspace, 'video-raw');
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    ...(film ? { recordVideo: { dir: raw, size: { width: 390, height: 844 } } } : {}),
  });
  const page = (activePage = await context.newPage());
  page.setDefaultTimeout(11000);
  const photoRequests = new Map();
  const pending = [];
  const outside = [];
  const errors = [];
  const tileFailures = new Set();
  const tileRequests = new Set();
  const tilePolicy = 'https://tile.openstreetmap.org';
  if (offline) await context.route('https://**/*', (route) => route.abort('internetdisconnected'));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin === tilePolicy) tileRequests.add(url.pathname);
    else if (url.origin !== origin && /^https?:$/.test(url.protocol)) outside.push(url.origin);
  });
  page.on('requestfailed', (request) => {
    if (new URL(request.url()).origin === tilePolicy)
      tileFailures.add(new URL(request.url()).pathname);
  });
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const externalTile = message.location().url.startsWith(tilePolicy);
    if (!externalTile) errors.push(message.text());
  });
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin === tilePolicy && !response.ok() && response.status() !== 304)
      tileFailures.add(url.pathname);
    if (url.origin !== origin || url.pathname !== api('/api/place-photos')) return;
    pending.push(
      response.json().then((rows) => {
        assert(response.ok(), 'Recorded photo endpoint failed');
        for (const row of rows) photoRequests.set(row.id, row.photo);
      }),
    );
  });

  const clock = performance.now();
  const b = (name) => page.getByRole('button', { name, exact: true });
  const tab = (name) => page.getByRole('tab', { name, exact: true });
  const show = (name) =>
    page.getByText(name, { exact: true }).filter({ visible: true }).first().waitFor();
  const tiles = async () =>
    page.evaluate(() => {
      const rows = [...document.images].filter((image) =>
        image.src.startsWith('https://tile.openstreetmap.org/'),
      );
      return {
        requested: rows.length,
        loaded: rows.filter((image) => image.complete && image.naturalWidth > 0).length,
      };
    });
  const mapFrame = async (name) => {
    await pause(700);
    if (!offline)
      await page.waitForFunction(
        () => {
          const rows = [...document.images].filter((image) =>
            image.src.startsWith('https://tile.openstreetmap.org/'),
          );
          return rows.length > 0 && rows.every((image) => image.complete && image.naturalWidth > 0);
        },
        undefined,
        { timeout: 26000 },
      );
    result.maps[name] = await tiles();
    if (!offline) assert.equal(result.maps[name].loaded, result.maps[name].requested);
  };
  const screen = async (name, hold = 7000, motion = false) => {
    step = name;
    if (!motion) {
      await page.evaluate(() => document.fonts.ready.then(() => true));
      await pause(460);
    }
    if (index === 1 && !offline && !film && !flag('no-screenshots'))
      await page.screenshot({ path: join(shots, name + '.png'), scale: 'device' });
    if (film) {
      result.frames[name] = Math.round(performance.now() - clock);
      if (!motion) await pause(film === 'highlights' ? Math.round(hold / 6.3) : hold);
    }
  };
  const checkedCall = async (path, action, expected = endpoint(path)) => {
    const wait = page.waitForResponse((response) => new URL(response.url()).pathname === api(path));
    await action();
    const response = await wait;
    assert(response.ok(), path + ' returned ' + response.status());
    const body = await response.json();
    assert.deepEqual(body, expected.response, path + ' replay changed');
    return body;
  };
  const image = async (place) => {
    const original = expectedPhotos.get(place.id).url;
    await page.waitForFunction((url) => {
      const localPath = window.__TRAVEL_DNA_DEMO__.photos[url];
      return [...document.images].some(
        (img) => localPath && img.src.endsWith(localPath) && img.complete && img.naturalWidth > 0,
      );
    }, original);
  };

  const choose = async (id) => {
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    assert.equal(new URL(page.url()).pathname, '/demo');
    await page.getByRole('link', { name: labels[id], exact: true }).click();
    await page.waitForFunction((id) => window.__TRAVEL_DNA_DEMO__?.scenario === id, id);
  };
  step = 'start';
  await choose(scenario);
  const bootstrap = await page.evaluate(() => ({ ...window.__TRAVEL_DNA_DEMO__ }));
  assert.equal(bootstrap.protocol, startup.protocol);
  assert.equal(bootstrap.bundle, startup.bundle);
  await b('서울 여행 시작하기').waitFor();
  await show('발표 모드 · 실제 추천 기록 재생');
  assert.equal(await page.evaluate(() => window.__TRAVEL_DNA_DEMO__.epoch), epoch);
  await page.waitForFunction(() =>
    [...document.images].some((img) => img.complete && img.naturalWidth > 0),
  );
  if (!film)
    await page.evaluate(() => {
      localStorage.setItem('@travel-dna/v1', 'service-sentinel');
      localStorage.setItem('@travel-dna/server-trip/v1', 'service-trip-sentinel');
    });
  await screen('01-intro', 9700);
  step = 'open planning';
  await b('서울 여행 시작하기').click();
  await b('여행 설계').click();
  await screen('02-trip-setup', 6800);
  const goal = page.getByLabel('여행 목적');
  await goal.fill(record.scenario.purpose);
  await goal.blur();
  await screen('17-trip-purpose', 4700);
  step = 'send profile and survey';
  if (await b('취향 설문 시작').isVisible())
    await checkedCall('/api/trip-profile', () => b('취향 설문 시작').click());
  else throw Error('Trip setup is unavailable');
  for (const [i, rating] of record.scenario.answers.entries())
    await page
      .getByRole('radio', { name: new RegExp('^' + (i + 1) + '번 문항 ' + rating + '점') })
      .click();
  await screen('18-likert-answers', 1800);
  await page.getByRole('heading', { name: /어떤 여행에/ }).scrollIntoViewIfNeeded();
  await screen('03-likert', 8700);
  await checkedCall('/api/dna-chat/likert', () => b('설문 제출').click());
  await show(endpoint('/api/dna-chat/likert').response.assistant_message);
  const answer = page.getByLabel('대화 답변');
  await answer.fill(messages[0].request.message);
  await screen('04-ai-chat', 10500);
  for (const turn of messages) {
    await answer.fill(turn.request.message);
    await checkedCall(turn.path, () => b('답변 보내기').click(), turn);
  }
  await show(messages.at(-1).response.assistant_message);
  await page.getByLabel('꼭 원하는 것').fill(record.scenario.mustHave);
  await page.getByLabel('피하고 싶은 것').fill(record.scenario.mustAvoid);
  await screen('05-constraints', 9500);
  await checkedCall('/api/dna-chat/constraints', () => b('조건 제출').click());
  await checkedCall('/api/dna-chat/finalize', () => b('취향 확정').click());
  await b('서울 장소 추천 받기').waitFor();
  await screen('06-confirmed-dna', 11500);

  const found = checkedCall('/api/seoul-find', () => b('서울 장소 추천 받기').click());
  await show('서울에서 만날 장소를 찾고 있어요');
  await pause(205);
  await screen('07-recommendation-loading', 0, true);
  await found;
  await tab('Day 1').waitFor();
  while (
    photoRequests.size < candidates.length &&
    performance.now() - clock < (film ? 210000 : 45000)
  )
    await pause(120);
  await Promise.all(pending);
  assert.deepEqual(photoRequests, expectedPhotos, 'Photo endpoint output changed');
  result.photos = await page.evaluate(async () => {
    const paths = Object.values(window.__TRAVEL_DNA_DEMO__.photos);
    return (
      await Promise.all(
        paths.map(async (path) => {
          const image = new Image();
          image.src = path;
          return image.decode().then(
            () => true,
            () => false,
          );
        }),
      )
    ).filter(Boolean).length;
  });
  assert.equal(result.photos, record.summary.verifiedPhotos);

  await tab('전체').click();
  await show('15곳 · 서버 추천 · 직선 연결은 실제 이동 경로가 아니에요.');
  await mapFrame('all');
  await screen('08-map-all', 9000);
  for (const day of [1, 2, 3]) {
    await tab('Day ' + day).click();
    await show('서울 여행 · Day ' + day);
    await mapFrame('day' + day);
    if (scenario === 'b' && day === 2) await image(itinerary[1][0]);
    assert.equal(await tab('Day ' + day).getAttribute('aria-selected'), 'true');
    await screen(String(8 + day).padStart(2, '0') + '-day' + day, 7300);
  }

  step = 'drag';
  const handle = b('추천 목록 접기');
  const box = await handle.boundingBox();
  assert(box);
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 90, { steps: 10 });
  const moved = await handle.boundingBox();
  await page.mouse.move(x, y - 150, { steps: 6 });
  await page.mouse.up();
  await b('목록 접기').waitFor();
  result.pointerTravel = box.y - moved.y;
  assert(result.pointerTravel >= 55, 'Recommendation sheet did not follow the pointer');

  const card = b(reference.name + ' 상세 보기').first();
  await card.scrollIntoViewIfNeeded();
  await image(reference);
  await screen('12-expanded-sheet', 9000);
  await card.click();
  await b('장소 저장').waitFor();
  await image(reference);
  await screen('13-place-detail', 12000);
  await b('장소 저장').click();
  await b('장소 저장 취소').waitFor();
  await b('이전 화면으로').click();
  await tab('찜한 장소').click();
  await card.waitFor();
  await screen('14-saved', 8500);

  step = 'stored shortlist and reload';
  if (!film) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await card.waitFor();
    result.bookmarkRestored = true;
  }
  const stored = await page.evaluate(() => {
    const { epoch, scenario } = window.__TRAVEL_DNA_DEMO__;
    const key = '@travel-dna/presentation/' + (scenario === 'a' ? 'a/' : '') + epoch;
    return JSON.parse(localStorage.getItem(key + '/server-trip/v1'));
  });
  const places = stored.entries.map((entry) => entry.place);
  assert.deepEqual(
    places.map((place) => place.id),
    candidates.map((place) => place.id),
  );
  result.shortlist = places.map((place) => place.name);
  result.itinerary = createItinerary(places).map((day) => day.map((place) => place.name));
  assert.deepEqual(
    result.itinerary,
    itinerary.map((day) => day.map((place) => place.name)),
  );

  await tab('내 여행').click();
  await page
    .getByRole('button', { name: /첫 번째 방문|1번째 방문/ })
    .first()
    .waitFor()
    .catch(async () => {
      await page.getByText('Day 1', { exact: true }).filter({ visible: true }).first().waitFor();
    });
  await screen('15-my-trip', 7800);
  await page.getByRole('heading', { name: 'Day 2', exact: true }).evaluate((element) => {
    element.scrollIntoView({ block: 'start' });
  });
  await screen('19-my-trip-days-2-3', 4700);
  await tab('취향 DNA').click();
  const dna = await page.evaluate(async (path) => {
    const response = await fetch(path);
    return response.json();
  }, api('/api/dna-chat/golden-session'));
  assert.deepEqual(dna, endpoint('/api/dna-chat/golden-session').response);
  result.dna = dna.confirmed_dna;
  for (const keyword of result.dna.micro_keywords) await show(keyword);
  await screen('16-dna-profile', 8500);

  if (!film) {
    step = 'scenario isolation, reset and input rejection';
    await choose(other);
    await b('서울 여행 시작하기').waitFor();
    const otherSession = await context.request.get(
      origin + prefix(other) + '/api/dna-chat/golden-session',
    );
    assert.equal(otherSession.status(), 409);
    await b('서울 여행 시작하기').click();
    await tab('찜한 장소').click();
    await show('마음에 드는 곳을 담아보세요');
    await choose(scenario);
    await tab('찜한 장소').click();
    await card.waitFor();
    result.scenarioIsolation = true;
    const next = await reset();
    await ready(next);
    await choose(scenario);
    await b('서울 여행 시작하기').waitFor();
    const storage = await page.evaluate(() => ({
      epoch: window.__TRAVEL_DNA_DEMO__.epoch,
      user: localStorage.getItem('@travel-dna/v1'),
      userTrip: localStorage.getItem('@travel-dna/server-trip/v1'),
      newTrip: localStorage.getItem(
        '@travel-dna/presentation/' +
          (window.__TRAVEL_DNA_DEMO__.scenario === 'a' ? 'a/' : '') +
          window.__TRAVEL_DNA_DEMO__.epoch +
          '/server-trip/v1',
      ),
    }));
    assert.deepEqual(storage, {
      epoch: next,
      user: 'service-sentinel',
      userTrip: 'service-trip-sentinel',
      newTrip: null,
    });
    await b('서울 여행 시작하기').click();
    await tab('찜한 장소').click();
    await show('마음에 드는 곳을 담아보세요');
    await tab('지도').click();
    await b('여행 설계').click();
    await b('취향 설문 시작').click();
    await b('설문 제출').waitFor();
    const radio = page.getByRole('radio');
    for (let i = 0; i < record.scenario.answers.length; i++) await radio.nth(i * 5).click();
    const failed = page.waitForResponse(
      (response) => new URL(response.url()).pathname === api('/api/dna-chat/likert'),
    );
    await b('설문 제출').click();
    const rejected = await failed;
    assert.equal(rejected.status(), 409);
    assert.equal((await rejected.json()).detail.code, 'demo_scenario_mismatch');
    await page
      .getByText(/발표 시나리오/)
      .filter({ visible: true })
      .first()
      .waitFor();
    result.resetVerified = true;
    result.differentInputRejected = true;
  }
  result.reference = reference.name;
  result.externalApiRequests = outside;
  result.mapTileRequests = tileRequests.size;
  result.tileFailures = [...tileFailures];
  // Chromium reports the intentional rejection via the resource console.
  result.consoleErrors = errors.filter(
    (error) => !(result.differentInputRejected && /status of 409/.test(error)),
  );
  result.intentionalRejectionConsole = errors.length - result.consoleErrors.length;
  assert.deepEqual(outside, []);
  assert.deepEqual(result.consoleErrors, []);
  result.elapsedMs = Math.round(performance.now() - clock);
  if (film) {
    const video = page.video();
    await context.close();
    context = undefined;
    const input = await video.path();
    const output = join(final, 'videos', film + suffix + '.mp4');
    const process = spawnSync(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        input,
        '-c:v',
        'libx264',
        '-crf',
        '19',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        output,
      ],
      { stdio: 'inherit' },
    );
    assert.equal(process.status, 0, 'Could not encode the browser recording');
  }
  result.success = true;
}

try {
  for (let index = 1; index <= runs; index++) {
    const result = { index, offline, success: false, maps: {}, frames: {} };
    results.push(result);
    try {
      await run(index, result);
      console.log(
        '회차',
        index,
        result.elapsedMs + 'ms',
        '사진',
        result.photos,
        '지도',
        result.maps,
      );
    } catch (error) {
      result.failedStep = step;
      result.error = String(error);
      if (activePage && !flag('no-screenshots'))
        await activePage
          .screenshot({ path: join(workspace, 'last-failure.png') })
          .catch(() => undefined);
      throw error;
    } finally {
      await context?.close();
      context = undefined;
      activePage = undefined;
    }
  }
} finally {
  await browser.close();
  await writeFile(
    join(evidence, reportName + suffix + '.json'),
    JSON.stringify(results, null, 2) + '\n',
  );
}

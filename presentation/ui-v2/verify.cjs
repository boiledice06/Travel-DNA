const { chromium } = require(process.env.TRAVEL_PLAYWRIGHT || 'playwright');
const fs = require('node:fs/promises');
const path = require('node:path');

const [stage, mode = 'fixture', dimension = '390x844', exportDir] = process.argv.slice(2);
const [width, height] = dimension.split('x').map(Number);
const origin = 'http://localhost:8091';
const output = path.resolve(
  process.env.TRAVEL_EVIDENCE_ROOT || 'presentation/ui-v2',
  stage,
  dimension,
);
const turn = (phase, assistant_message, chips = [], n = 0) => ({
  session_id: 'ui-v2-fixture',
  phase,
  assistant_message,
  chips,
  turn: n,
});
const keywords = ['산책', '박물관', '미술 전시', '한적한 골목'];
const conditions = { must_have: '박물관과 미술관', must_avoid: '술집' };
const names = [
  '서울숲',
  '서울시립미술관',
  '국립중앙박물관',
  '낙산공원',
  '덕수궁',
  '국립현대미술관 서울',
  '서울역사박물관',
  '남산공원',
  '한양도성박물관',
];
const coords = [
  [37.544, 127.038],
  [37.564, 126.974],
  [37.524, 126.981],
  [37.58, 127.008],
  [37.566, 126.975],
  [37.578, 126.981],
  [37.57, 126.969],
  [37.551, 126.99],
  [37.571, 127.009],
];
const questions = [
  '걷기 좋은 거리를 발견하는 여행을 좋아해요.',
  '여행 중 미술관이나 박물관을 자주 찾아요.',
  '사람이 적은 조용한 장소에서 쉬고 싶어요.',
  '잘 알려지지 않은 동네를 탐색하고 싶어요.',
  '이동이 적고 여유로운 일정을 선호해요.',
];
const scale = ['전혀 아니다', '아니다', '보통이다', '그렇다', '매우 그렇다'].map((label_ko, i) => ({
  value: i + 1,
  label_ko,
}));

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', args: ['--disable-dev-shm-usage'] });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    ...(process.env.TRAVEL_RECORD
      ? { recordVideo: { dir: '.codex-temp/presentation-v2-video', size: { width, height } } }
      : {}),
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const evidence = {
    browser: await browser.version(),
    stage,
    mode,
    dimension,
    requests: [],
    errors: [],
    checks: [],
    imageFailures: [],
  };
  page.on('pageerror', (error) => evidence.errors.push(String(error)));
  const loadedPhotos = new Map();
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/'))
      evidence.requests.push([
        response.request().method(),
        url.pathname.replace(
          /\/api\/dna-chat\/(?!start|likert|message|constraints|finalize)[^/]+$/,
          '/api/dna-chat/:id',
        ),
        response.status(),
      ]);
    if (/^(tong|cdn)\.visitkorea\.or\.kr$/.test(url.hostname))
      loadedPhotos.set(response.url(), response.status());
    if (response.status() >= 400 && /openstreetmap|visitkorea|unsplash/.test(url.hostname))
      evidence.imageFailures.push([url.hostname, response.status()]);
  });
  page.on('requestfailed', (request) => {
    const host = new URL(request.url()).hostname;
    if (/openstreetmap|visitkorea|unsplash/.test(host))
      evidence.imageFailures.push([host, request.failure()?.errorText]);
  });
  if (exportDir) {
    const files = new Map();
    await page.route(origin + '/**', async (route) => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
      const relative =
        pathname.startsWith('/assets/') || pathname.startsWith('/_expo/')
          ? pathname.slice(1)
          : 'index.html';
      const file = path.resolve(exportDir, relative);
      const root = path.resolve(exportDir) + path.sep;
      if (!file.startsWith(root)) return route.abort();
      try {
        if (!files.has(file)) files.set(file, await fs.readFile(file));
        const mime = {
          '.js': 'text/javascript',
          '.html': 'text/html',
          '.ttf': 'font/ttf',
          '.woff2': 'font/woff2',
          '.jpg': 'image/jpeg',
          '.png': 'image/png',
          '.json': 'application/json',
        }[path.extname(file)];
        await route.fulfill({ body: files.get(file), contentType: mime });
      } catch {
        await route.fulfill({ status: 404 });
      }
    });
  }
  if (mode === 'fixture') {
    let messages = 0;
    let failedOnce = false;
    await page.route('**/api/**', async (route) => {
      if (route.request().method() === 'OPTIONS')
        return route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          },
        });
      const segment = new URL(route.request().url()).pathname.split('/').at(-1);
      let json;
      let status = 200;
      switch (segment) {
        case 'trip-profile':
          json = { id: 'ui-v2-profile' };
          break;
        case 'start':
          json = {
            ...turn('likert', '다섯 문장으로 서울에서의 여행 취향을 알려 주세요.'),
            likert_items: questions.map((statement_ko, i) => ({
              statement_ko,
              id: 'q' + i,
              scale,
            })),
          };
          break;
        case 'likert':
          json = turn('asking', '서울에서 어떤 장면을 가장 오래 기억하고 싶나요?', [
            '조용한 전시',
            '동네 산책',
          ]);
          break;
        case 'message':
          await new Promise((resolve) => setTimeout(resolve, 500));
          if (process.env.TRAVEL_TEST_RETRY && !failedOnce) {
            failedOnce = true;
            status = 502;
            json = {};
            break;
          }
          messages++;
          json =
            messages === 1
              ? turn(
                  'asking',
                  '전시와 산책 중 일정에 먼저 담고 싶은 것은 무엇인가요?',
                  ['전시 먼저'],
                  1,
                )
              : turn('constraints', '꼭 하고 싶은 일과 피하고 싶은 일을 알려 주세요.', [], 2);
          break;
        case 'constraints':
          json = turn('draft', '조건을 확인하고 여행 취향을 확정해 주세요.');
          break;
        case 'finalize':
          json = {
            ...turn('confirmed', ''),
            travel_dna: { micro_keywords: keywords },
            ...conditions,
          };
          break;
        case 'ui-v2-fixture':
          json = {
            ...turn('confirmed', ''),
            confirmed_dna: { micro_keywords: keywords },
            ...conditions,
          };
          break;
        case 'seoul-find':
          await new Promise((resolve) => setTimeout(resolve, 900));
          json = {
            shortlist: names.map((name, i) => ({
              name,
              place_id: 'fixture-' + i,
              source: 'UI 검증 fixture',
              lat: coords[i][0],
              lng: coords[i][1],
              address: '서울',
              source_keyword: i % 2 ? '미술관' : '산책',
            })),
          };
          break;
        default:
          status = 404;
          json = {};
      }
      await route.fulfill({ status, json, headers: { 'Access-Control-Allow-Origin': origin } });
    });
  }
  if (mode === 'live') {
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const headers = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      try {
        const response = await fetch('http://127.0.0.1:8778' + new URL(request.url()).pathname, {
          method: request.method(),
          headers: { 'Content-Type': 'application/json' },
          body: request.postData() || undefined,
          signal: AbortSignal.timeout(118000),
        });
        await route.fulfill({
          status: response.status,
          headers,
          contentType: 'application/json',
          body: await response.text(),
        });
      } catch {
        await route.fulfill({ status: 503, headers, json: {} });
      }
    });
  }
  const button = (name) => page.getByRole('button', { name: new RegExp(name + '$') });
  const before = stage.startsWith('before');
  const dayControl = (name) => page.getByRole(before ? 'button' : 'tab', { name, exact: true });
  const click = async (name) => {
    const exact = page.getByRole('button', { name, exact: true });
    if (await exact.count()) await exact.click();
    else await button(name).click();
  };
  const visible = (text) =>
    page
      .getByText(text, { exact: false })
      .filter({ visible: true })
      .first()
      .waitFor({ state: 'visible' });
  const cdp = await context.newCDPSession(page);
  const touch = async (x, y, dx, dy, capture) => {
    const send = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
    await send('touchStart', [{ x, y }]);
    for (let step = 1; step <= 12; step++) {
      await send('touchMove', [
        { x: Math.round(x + (dx * step) / 12), y: Math.round(y + (dy * step) / 12) },
      ]);
      await page.waitForTimeout(17);
    }
    const evidence = await capture?.();
    await send('touchEnd', []);
    return evidence;
  };
  const shot = async (name) => {
    await page.waitForTimeout(435);
    await page.screenshot({ path: path.join(output, name + '.png'), timeout: 12000 });
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    evidence.checks.push({ name, horizontalPageOverflow: scrollWidth > clientWidth });
  };
  try {
    await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await button('데모로 먼저 둘러보기').waitFor({ timeout: 60000 });
    await shot('01-intro');
    await click('데모로 먼저 둘러보기');
    await button('나와 닮은 장소 발견하기').waitFor();
    await shot('02-onboarding-dna');
    await click('나와 닮은 장소 발견하기');
    await button('지도 옵션 열기').waitFor();
    await shot('03-map');
    if (stage.startsWith('before')) {
      await click('지도 옵션 열기');
      await page.getByRole('button', { name: /여행 조건 수정/ }).click();
    } else await click('여행 설계');
    await button('취향 설문 시작').waitFor();
    await shot('04-trip-setup');
    await click('취향 설문 시작');
    await page.getByRole('radio').first().waitFor({ timeout: 40000 });
    if (await button('설문 제출').isEnabled()) throw Error('Incomplete survey enabled submission');
    await shot('05-likert');
    const radios = page.getByRole('radio');
    const count = await radios.count();
    for (let i = 0; i < count; i += 5) await radios.nth(i + 3).click();
    await click('설문 제출');
    const input = page.getByLabel('대화 답변');
    await input.waitFor({ timeout: 40000 });
    if (!before && mode === 'fixture') {
      await input.focus();
      await page.setViewportSize({ width, height: height - 255 });
      const composer = await input.boundingBox();
      if (!composer || composer.y + composer.height > height - 253 || composer.y < 0)
        throw Error('Composer left the smaller viewport');
      await page.setViewportSize({ width, height });
      evidence.checks.push({ name: 'composer-resize', held: true });
    }
    await shot('06-chat');
    await input.fill('조용한 박물관과 미술 전시, 산책을 좋아해요.');
    await click('답변 보내기');
    if (!before && mode === 'fixture') {
      await visible('답변을 준비하고');
      await page.screenshot({ path: path.join(output, '06a-chat-wait.png') });
    }
    if (process.env.TRAVEL_TEST_RETRY && mode === 'fixture') {
      await visible('HTTP 502');
      if (!(await input.inputValue()).startsWith('조용한')) throw Error('Failed chat lost draft');
      await shot('06b-chat-retry');
      await click('답변 보내기');
    }
    let liveRetries = 0;
    for (let n = 0; n < 6; n++) {
      await page.waitForFunction(
        () => {
          const input = document.querySelector('[aria-label="대화 답변"]');
          return (
            !!document.querySelector('[aria-label="꼭 원하는 것"]') ||
            !!document.querySelector('[role="alert"]') ||
            (input && !input.value)
          );
        },
        null,
        { timeout: 40000 },
      );
      if (await page.getByLabel('꼭 원하는 것').isVisible()) break;
      if (await page.getByRole('alert').isVisible()) {
        if (mode !== 'live' || liveRetries >= 2 || !(await input.inputValue()))
          throw Error(await page.getByRole('alert').innerText());
        liveRetries += 1;
        await click('답변 보내기');
        continue;
      }
      if (mode === 'live' && n === 0) await shot('06-live-question');
      await input.fill('전시 먼저, 그다음 한적한 골목을 걷고 싶어요.');
      await click('답변 보내기');
    }
    await page.getByLabel('꼭 원하는 것').fill(conditions.must_have, { timeout: 40000 });
    await page.getByLabel('피하고 싶은 것').fill(conditions.must_avoid);
    await shot('07-constraints');
    await click('조건 제출');
    await button('취향 확정').waitFor({ timeout: 40000 });
    await shot('08-draft');
    await click('취향 확정');
    await button('서울 장소 추천 받기').waitFor({ timeout: 40000 });
    await shot('09-confirmed-dna');
    const waitForRecommendation = () =>
      page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/seoul-find' &&
          response.request().method() === 'POST',
        { timeout: 125000 },
      );
    const responsePromise = waitForRecommendation();
    await click('서울 장소 추천 받기');
    if (!stage.startsWith('before') && mode === 'fixture') await shot('10-recommendation-loading');
    let response = await responsePromise;
    if (mode === 'live' && [502, 503].includes(response.status())) {
      await visible('HTTP ' + response.status());
      const retried = waitForRecommendation();
      await click('서울 장소 추천 받기');
      response = await retried;
    }
    if (!response.ok()) throw Error('Recommendation returned HTTP ' + response.status());
    const { shortlist } = await response.json();
    const photo = shortlist.find((row) =>
      /^https:\/\/(tong|cdn)\.visitkorea\.or\.kr\//.test(row.image_url ?? ''),
    );
    evidence.shortlist = {
      count: shortlist.length,
      providers: Object.fromEntries(
        [...new Set(shortlist.map((row) => row.source))].map((source) => [
          source,
          shortlist.filter((row) => row.source === source).length,
        ]),
      ),
      photoCandidates: shortlist.filter((row) => Boolean(row.image_url)).length,
    };
    await dayControl('Day 1').waitFor({ timeout: 125000 });
    if (await page.getByRole('alert').isVisible())
      throw Error(await page.getByRole('alert').innerText());
    if (!before && mode === 'fixture') {
      await dayControl('Day 3').click();
      await dayControl('Day 2').click();
    }
    await dayControl('Day 1').click();
    if (
      !before &&
      mode === 'fixture' &&
      (await dayControl('Day 1').getAttribute('aria-selected')) !== 'true'
    )
      throw Error('Rapid date changes did not settle on Day 1');
    await shot('11-day1');
    await dayControl('Day 2').click();
    await shot('12-day2');
    if (!stage.startsWith('before')) {
      const handle = page.getByLabel(/추천 목록 접기/).first();
      const box = await handle.boundingBox();
      const x = box.x + box.width / 2,
        y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y - 95, { steps: 10 });
      const moved = await handle.boundingBox();
      if (!moved || moved.y > box.y - 55)
        throw Error('Mouse drag did not move the sheet during the gesture');
      await page.mouse.move(x, y - 155, { steps: 6 });
      await page.mouse.up();
      await page.getByRole('button', { name: '목록 접기', exact: true }).waitFor();
      evidence.checks.push({ name: 'pointer-drag', travel: box.y - moved.y, snap: 'expanded' });
    } else await click('전체 추천 보기');
    await shot('13-sheet-expanded');
    if (!before && mode === 'fixture') {
      const expandedHandle = page.getByRole('button', { name: '추천 목록 접기', exact: true });
      const expandedBefore = await expandedHandle.boundingBox();
      const listCard = await page
        .getByRole('button', { name: /상세 보기/ })
        .first()
        .boundingBox();
      await touch(170, listCard.y + 110, 0, -160);
      await page.waitForTimeout(460);
      const expandedAfter = await expandedHandle.boundingBox();
      const newCard = await page
        .getByRole('button', { name: /상세 보기/ })
        .first()
        .boundingBox();
      if (Math.abs(expandedBefore.y - expandedAfter.y) > 3 || newCard.y > listCard.y - 50)
        throw Error('Expanded list scroll conflicted with sheet');
      evidence.checks.push({ name: 'expanded-scroll', scrollTravel: listCard.y - newCard.y });
    }
    await click('목록 접기');
    await page.waitForTimeout(500);
    if (!before && mode === 'fixture') {
      const handle = page.getByRole('button', { name: '추천 목록 접기', exact: true });
      const compact = await handle.boundingBox();
      const carousel = await page
        .getByRole('button', { name: /상세 보기/ })
        .first()
        .boundingBox();
      await touch(
        Math.min(carousel.x + carousel.width - 20, width - 24),
        carousel.y + 48,
        -Math.min(width - 65, 265),
        0,
      );
      await page.waitForTimeout(800);
      if (Math.abs((await handle.boundingBox()).y - compact.y) > 3)
        throw Error('Carousel moved the sheet');
      const activeCard = await page.getByText(/^장소 [1-3] \/ 3$/).innerText();
      const activePin = await page
        .locator('[aria-label$="지도 마커"][aria-selected="true"]')
        .getAttribute('aria-label');
      if (activeCard === '장소 1 / 3' || activePin?.startsWith('서울역사박물관'))
        throw Error('Carousel did not synchronize the selected pin');
      evidence.checks.push({ name: 'horizontal-carousel', card: activeCard, pin: activePin });
      await handle.click();
      const collapsed = page.getByRole('button', { name: '추천 장소 보기', exact: true });
      await collapsed.waitFor();
      await page.waitForTimeout(400);
      const start = await collapsed.boundingBox();
      const moved = await touch(start.x + start.width / 2, start.y + 16, 0, -150, () =>
        collapsed.boundingBox(),
      );
      await handle.waitFor();
      await page.waitForTimeout(460);
      if (
        !moved ||
        moved.y > start.y - 95 ||
        Math.abs((await handle.boundingBox()).y - compact.y) > 4
      )
        throw Error('Touch drag did not follow the finger or snap to compact');
      evidence.checks.push({ name: 'touch-drag', travel: start.y - moved.y, snap: 'compact' });
    }
    await dayControl('Day 3').click();
    await page.waitForTimeout(430);
    if (!before && mode === 'fixture') {
      const markers = page.getByRole('button', { name: /지도 마커/ });
      const boxes = await Promise.all(
        (await markers.all()).map((locator) => locator.boundingBox()),
      );
      const handle = await page
        .getByRole('button', { name: '추천 목록 접기', exact: true })
        .boundingBox();
      if (
        boxes.length !== 3 ||
        boxes.some(
          (box) =>
            !box ||
            box.y < 65 ||
            box.y + box.height > handle.y ||
            box.x < 0 ||
            box.x + box.width > width,
        )
      )
        throw Error('A Day 3 pin was outside the visible map');
      const pinBefore = await page
        .getByRole('button', { name: '국립중앙박물관 지도 마커' })
        .boundingBox();
      evidence.checks.push({
        name: 'day3-camera',
        shown: boxes.length,
        selectedPin: { x: pinBefore.x, y: pinBefore.y },
      });
    }
    await shot('14-day3');
    const first = page.getByRole('button', { name: /상세 보기/ }).first();
    await first.click();
    await button('장소 저장').waitFor();
    if (mode === 'fixture') await visible('사진 없음');
    await shot('15-place-detail');
    await click('장소 저장');
    await click('이전 화면으로');
    await dayControl('Day 3').waitFor();
    const daySelected = await dayControl('Day 3').getAttribute('aria-selected');
    evidence.checks.push({ name: 'day-after-detail', selected: daySelected });
    if (!stage.startsWith('before') && daySelected !== 'true')
      throw Error('Day 3 selection was lost after detail');
    await page.getByRole('tab', { name: /찜한 장소/ }).click();
    await page
      .getByRole('button', { name: /상세 보기/ })
      .first()
      .waitFor();
    await shot('16-saved');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page
      .getByRole('button', { name: /상세 보기/ })
      .first()
      .waitFor();
    evidence.checks.push({ name: 'bookmark-reload', shown: true });
    await page.getByRole('tab', { name: /내 여행/ }).click();
    await visible('Day 3');
    await shot('17-my-trips');
    await page.getByRole('tab', { name: /취향 DNA/ }).click();
    await visible(mode === 'fixture' ? '한적한 골목' : '최근 확정한 서버 취향');
    await shot('18-profile');
    if (photo && mode === 'live') {
      await page.getByRole('tab', { name: '지도', exact: true }).click();
      const search = page.getByLabel('여행지 검색');
      await search.fill(photo.name);
      await page.getByText(photo.name, { exact: true }).first().click();
      await page.getByRole('button', { name: photo.name + ' 상세 보기', exact: true }).click();
      await visible('사진 출처');
      await page.waitForFunction(
        () =>
          Array.from(document.images).some(
            (image) =>
              image.src.includes('visitkorea.or.kr') && image.complete && image.naturalWidth > 0,
          ),
        null,
        { timeout: 12000 },
      );
      const status = loadedPhotos.get(photo.image_url);
      evidence.checks.push({ name: 'live-tourapi-photo', status, statusConfirmed: status === 200 });
      await shot('19-live-tourapi-photo');
      await page.route('https://*.visitkorea.or.kr/**', (route) => route.abort('failed'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await visible('사진 없음');
      evidence.checks.push({ name: 'live-photo-network-fallback', passed: true });
      await shot('20-live-photo-fallback');
    }
    if (!before && mode === 'fixture') {
      await page.getByRole('tab', { name: '내 여행', exact: true }).click();
      await click('여행 기록 보기');
      await click('여행 기록 추가');
      const visited = page.getByLabel('방문 지역 또는 장소');
      await visited.fill('UI 검증용 새 여행 기록');
      await click('이 기억 저장하기');
      await click('UI 검증용 새 여행 기록 기록 수정');
      await visited.fill('UI 검증용 수정 기록');
      await click('이 기억 저장하기');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await click('UI 검증용 수정 기록 기록 삭제');
      await click('기록 삭제');
      await page.getByText('UI 검증용 수정 기록', { exact: true }).waitFor({ state: 'hidden' });
      evidence.checks.push({ name: 'local-record-create-edit-reload-delete', passed: true });
    }
    if (evidence.checks.some((check) => check.horizontalPageOverflow))
      throw Error('A page overflowed horizontally');
    evidence.completed = true;
  } catch (error) {
    evidence.error = String(error);
    console.error(evidence.error);
    await shot('99-blocker').catch(() => {});
    process.exitCode = 1;
  } finally {
    await context.close();
    if (process.env.TRAVEL_RECORD && page.video()) {
      const video = await page.video().path();
      evidence.video = path.basename(video);
    }
    await browser.close();
    await fs.writeFile(
      path.join(output, 'evidence.json'),
      JSON.stringify(evidence, null, 2) + '\n',
    );
    console.log(
      JSON.stringify({
        completed: evidence.completed,
        requests: evidence.requests,
        checks: evidence.checks.length,
        errors: evidence.errors,
        imageFailures: evidence.imageFailures.length,
      }),
    );
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

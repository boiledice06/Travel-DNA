const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.TRAVEL_PLAYWRIGHT || 'playwright');

const [mode = 'live', exportDir, historicalPath] = process.argv.slice(2);
const output = path.resolve('presentation/image-enrichment', mode);
const origin = 'http://localhost:8091';
const backend = 'http://127.0.0.1:8778';
const assetTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

function historicalTrip(shortlist) {
  return {
    version: 1,
    serverUrl: backend,
    profileId: 'research-baseline',
    sessionId: 'research-baseline',
    entries: shortlist.map((row) => {
      const id = `api:${encodeURIComponent(row.source)}:${encodeURIComponent(row.place_id)}`;
      return {
        place: {
          id,
          externalId: row.place_id,
          name: row.name,
          region: 'seoul',
          country: '대한민국',
          district: row.address || '',
          latitude: row.lat,
          longitude: row.lng,
          description: '',
          image: row.image_url || '',
          category: row.source_keyword || '장소',
          positiveAttributes: {},
          negativeAttributes: {},
          reviewKeywords: [],
          source: 'api',
          sourceName: row.source,
        },
        recommendation: {
          placeId: id,
          score: null,
          matchedAttributes: [],
          conflictingAttributes: [],
          reason: '서버에서 별도의 추천 이유를 제공하지 않았어요.',
        },
      };
    }),
  };
}

async function run() {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge' });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const result = { mode, browser: browser.version(), http: [], screenshots: [], pageErrors: [] };
  const photos = new Map();
  const t0 = performance.now();
  const started = () => Math.round(performance.now() - t0);
  let firstFind;
  let firstPhoto;
  let photoBatches = 0;
  page.on('pageerror', (error) => result.pageErrors.push(error.message));
  const staticFiles = new Map();
  const root = path.resolve(exportDir);
  await page.route(origin + '/**', async (route) => {
    const uri = decodeURIComponent(new URL(route.request().url()).pathname);
    const relative =
      uri.startsWith('/assets/') || uri.startsWith('/_expo/') ? uri.slice(1) : 'index.html';
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) return route.abort();
    try {
      if (!staticFiles.has(file)) staticFiles.set(file, await fs.readFile(file));
      await route.fulfill({
        body: staticFiles.get(file),
        contentType: assetTypes[path.extname(file)],
      });
    } catch {
      await route.fulfill({ status: 404 });
    }
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const endpoint = new URL(request.url()).pathname;
    const headers = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type,Idempotency-Key',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    try {
      const at = started();
      const upstream = await fetch(backend + endpoint, {
        method: request.method(),
        body: request.postData() || undefined,
        headers: {
          'Content-Type': 'application/json',
          ...(request.headers()['idempotency-key'] && {
            'Idempotency-Key': request.headers()['idempotency-key'],
          }),
        },
        signal: AbortSignal.timeout(118000),
      });
      const body = await upstream.text();
      const returned = started();
      if (endpoint === '/api/seoul-find') firstFind = returned;
      if (endpoint === '/api/place-photos' && upstream.ok) {
        firstPhoto ??= at;
        for (const item of JSON.parse(body)) photos.set(item.id, item);
        photoBatches++;
      }
      const safePath = endpoint.replace(/\/dna-chat\/[0-9a-f]{12}$/, '/dna-chat/:id');
      result.http.push({
        endpoint: safePath,
        status: upstream.status,
        startMs: at,
        elapsedMs: returned - at,
      });
      return route.fulfill({
        status: upstream.status,
        headers,
        contentType: 'application/json',
        body,
      });
    } catch {
      return route.fulfill({ status: 503, headers, json: {} });
    }
  });
  const button = (name) => page.getByRole('button', { name, exact: true });
  const tab = (name) => page.getByRole('tab', { name, exact: true });
  const text = (name) => page.getByText(name, { exact: true }).filter({ visible: true }).first();
  const responseFor = (endpoint) =>
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === endpoint && response.request().method() === 'POST',
      { timeout: 125000 },
    );
  const shot = async (name) => {
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(output, name + '.png') });
    result.screenshots.push(name + '.png');
  };
  const wait = async (predicate) => {
    for (let i = 0; i < 100; i++) {
      if (predicate()) return;
      await page.waitForTimeout(300);
    }
    throw Error('Background photo lookup did not finish within 30 seconds');
  };
  const select = async (name) => {
    const input = page.getByLabel('여행지 검색');
    await input.fill(name);
    // Search suggestions expose the place title plus address. Card buttons have an explicit label.
    await page
      .locator('button:not([aria-label])')
      .filter({ has: text(name) })
      .first()
      .click();
    await input.waitFor();
    const card = button(name + ' 상세 보기').first();
    await card.waitFor();
    return card;
  };
  const imageReady = (url) =>
    page.waitForFunction(
      (src) =>
        [...document.images].some(
          (image) => image.src === src && image.complete && image.naturalWidth > 0,
        ),
      url,
      { timeout: 15000 },
    );
  const imageAudit = async (urls) => {
    return page.evaluate(async (list) => {
      const read = async (url) => {
        const img = new Image();
        let timer;
        try {
          img.src = url;
          return await Promise.race([
            img.decode().then(
              () => true,
              () => false,
            ),
            new Promise((resolve) => {
              timer = setTimeout(() => resolve(false), 6500);
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
      };
      const results = [];
      for (let i = 0; i < list.length; i += 3)
        results.push(...(await Promise.all(list.slice(i, i + 3).map(read))));
      return results;
    }, urls);
  };
  try {
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await button('데모로 먼저 둘러보기').click();
    await button('나와 닮은 장소 발견하기').click();
    await button('여행 설계').waitFor();
    let shortlist;
    let reference;
    if (mode !== 'live') {
      const historical = JSON.parse(await fs.readFile(historicalPath, 'utf8'));
      shortlist = historical.shortlist;
      const match =
        historical.photos.find((item) => item.id.startsWith('api:kakao:') && item.photo) ??
        historical.photos.find((item) => item.photo);
      reference = shortlist.find(
        (row) =>
          match?.id === `api:${encodeURIComponent(row.source)}:${encodeURIComponent(row.place_id)}`,
      );
      await page.evaluate(
        (trip) => localStorage.setItem('@travel-dna/server-trip/v1', JSON.stringify(trip)),
        historicalTrip(shortlist),
      );
      await page.reload({ waitUntil: 'domcontentloaded' });
      await tab('지도').waitFor();
      if (mode === 'after') await wait(() => photos.size === shortlist.length);
      if (!reference) throw Error('Historical case has no verified reference');
    } else {
      await button('여행 설계').click();
      await button('취향 설문 시작').click();
      await page.getByRole('radio').first().waitFor();
      if (await button('설문 제출').isEnabled()) throw Error('An incomplete survey is enabled');
      const scale = page.getByRole('radio');
      for (let i = 0; i < (await scale.count()); i += 5) await scale.nth(i + 3).click();
      await button('설문 제출').click();
      const input = page.getByLabel('대화 답변');
      await input.waitFor();
      await input.focus();
      await page.setViewportSize({ width: 390, height: 620 });
      const composer = await input.boundingBox();
      if (!composer || composer.y < 0 || composer.y + composer.height > 620)
        throw Error('Chat composer left the reduced viewport');
      result.composerViewport = true;
      await page.setViewportSize({ width: 390, height: 844 });
      await input.blur();
      await shot('01-chat');
      const messages = [
        '조용한 박물관과 미술 전시를 보고, 한적한 골목과 공원을 걷고 싶어요.',
        '실내 미술 전시부터 보고 오후에는 조용한 골목을 산책하고 싶어요.',
        '전통 건축과 작은 미술 전시를 좋아해요. 한적한 곳이 더 좋아요.',
        '미술 전시와 전통 건축이 가장 중요하고, 야간 술집은 피하고 싶어요.',
      ];
      for (const message of messages) {
        if (await page.getByLabel('꼭 원하는 것').isVisible()) break;
        await input.fill(message);
        const pending = responseFor('/api/dna-chat/message');
        await button('답변 보내기').click();
        const response = await pending;
        if (!response.ok()) throw Error('Live Gemini chat returned HTTP ' + response.status());
        const reply = await response.json();
        if (reply.phase === 'asking' && !result.screenshots.includes('01b-gemini-question.png')) {
          await text(reply.assistant_message).waitFor();
          await shot('01b-gemini-question');
        }
        if (reply.phase === 'constraints') break;
      }
      await page.getByLabel('꼭 원하는 것').fill('박물관과 미술관');
      await page.getByLabel('피하고 싶은 것').fill('술집');
      await button('조건 제출').click();
      await button('취향 확정').click();
      await button('서울 장소 추천 받기').waitFor();
      await shot('02-confirmed-dna');
      const find = responseFor('/api/seoul-find');
      await button('서울 장소 추천 받기').click();
      const response = await find;
      if (!response.ok()) throw Error('Live recommendation returned HTTP ' + response.status());
      const raw = await response.json();
      shortlist = raw.shortlist.map(
        ({ name, address, lat, lng, place_id, source, source_keyword, image_url, category }) => ({
          name,
          address,
          lat,
          lng,
          place_id,
          source,
          source_keyword,
          image_url,
          category,
        }),
      );
      await tab('Day 1').waitFor();
      result.mapSeenMs = started();
      result.photosWhenMapShown = photos.size;
      await wait(() => photos.size === shortlist.length);
      const match =
        [...photos.values()].find((item) => item.id.startsWith('api:kakao:') && item.photo) ??
        [...photos.values()].find((item) => item.photo);
      reference = shortlist.find(
        (row) =>
          match?.id === `api:${encodeURIComponent(row.source)}:${encodeURIComponent(row.place_id)}`,
      );
      if (!reference) throw Error('Live case yielded no validated photo');
    }
    const id = `api:${encodeURIComponent(reference.source)}:${encodeURIComponent(reference.place_id)}`;
    const selected = photos.get(id)?.photo;
    let card = await select(reference.name);
    if (selected) await imageReady(selected.url);
    await shot('03-map');
    const handle = button('추천 목록 접기');
    const box = await handle.boundingBox();
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 90, { steps: 10 });
    const moved = await handle.boundingBox();
    await page.mouse.move(x, y - 150, { steps: 5 });
    await page.mouse.up();
    await button('목록 접기').waitFor();
    result.pointerTravel = box.y - moved.y;
    if (result.pointerTravel < 55) throw Error('Sheet did not follow the pointer');
    card = button(reference.name + ' 상세 보기').first();
    await card.scrollIntoViewIfNeeded();
    await shot('04-list');
    await card.click();
    await button('장소 저장').waitFor();
    if (selected) await imageReady(selected.url);
    await shot('05-detail');
    await button('장소 저장').click();
    await button('이전 화면으로').click();
    await tab('찜한 장소').click();
    await button(reference.name + ' 상세 보기').waitFor();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await button(reference.name + ' 상세 보기').waitFor();
    result.bookmarkRestored = true;
    const originalIds = historicalTrip(shortlist).entries.map((row) => row.place.id);
    const persistedIds = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('@travel-dna/server-trip/v1')).entries.map(
        (row) => row.place.id,
      ),
    );
    if (JSON.stringify(originalIds) !== JSON.stringify(persistedIds))
      throw Error('Stored shortlist order changed');
    result.orderPreserved = true;
    await tab('내 여행').click();
    const itineraryRow = page
      .getByRole('button', {
        name: new RegExp(
          '번째 방문, ' + reference.name.replace(/[.*+?^$${}()|[\]\\]/g, '\\$&') + ' 상세 보기',
        ),
      })
      .first();
    await itineraryRow.scrollIntoViewIfNeeded();
    if (selected) await imageReady(selected.url);
    await shot('06-itinerary');
    const verified = [...photos.values()].filter((item) => item.photo);
    const urls = [...new Set(verified.map((item) => item.photo.url))];
    const imageChecks = await imageAudit(urls);
    if (selected && mode !== 'before') {
      await itineraryRow.click();
      await button('장소 저장 취소').waitFor();
      await page.route(selected.url, (route) => route.abort('failed'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await text('일러스트').waitFor();
      await shot('07-vector-fallback');
      result.photoFailureFallback = true;
    }
    result.completed = true;
    result.shortlist = shortlist;
    result.reference = reference.name;
    result.photos = [...photos.values()];
    result.providerNames = Object.fromEntries(
      [...new Set(shortlist.map((row) => row.source))].map((provider) => [
        provider,
        shortlist.filter((row) => row.source === provider).length,
      ]),
    );
    result.coverageBefore = shortlist.filter((row) => row.image_url).length;
    result.coverageAfter = verified.length;
    result.decodedImages = urls.map((url, index) => ({ url, decoded: imageChecks[index] }));
    result.photoBatches = photoBatches;
    if (firstFind !== undefined && firstPhoto !== undefined)
      result.firstPhotoRequestAfterFindMs = firstPhoto - firstFind;
  } catch (error) {
    result.error = String(error);
    console.error(result.error);
    await shot('99-blocker').catch(() => undefined);
    process.exitCode = 1;
  } finally {
    await browser.close();
    await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(
      JSON.stringify({
        mode,
        completed: result.completed,
        providerNames: result.providerNames,
        before: result.coverageBefore,
        after: result.coverageAfter,
        decoded: result.decodedImages?.filter((row) => row.decoded).length,
        images: result.decodedImages?.length,
        mapSeenMs: result.mapSeenMs,
        photoDelay: result.firstPhotoRequestAfterFindMs,
      }),
    );
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { decodePlacePhoto } from '../../src/services/backend/photos.ts';

const source = resolve(process.argv[2]);
const output = resolve(process.argv[3] ?? 'presentation/final/fixtures');
const record = JSON.parse(await readFile(source, 'utf8'));
const photos = new Map();
for (const call of record.calls.filter((item) => item.path === '/api/place-photos')) {
  for (const row of call.response) {
    const photo = decodePlacePhoto(row.photo);
    if (photo) photos.set(photo.url, photo);
  }
}
const photoManifest = {};
await mkdir(join(output, 'assets'), { recursive: true });
for (const [url] of photos) {
  const result = await fetch(url, {
    redirect: 'error',
    headers: { 'User-Agent': 'TravelDNA/1.0 (https://github.com/boiledice06/Travel-DNA)' },
    signal: AbortSignal.timeout(16000),
  });
  if (!result.ok)
    throw Error('Licensed image download HTTP ' + result.status + ' at ' + new URL(url).hostname);
  const declared = result.headers.get('Content-Type')?.split(';')[0];
  if (Number(result.headers.get('Content-Length')) > 12000000) throw Error('Unexpected image size');
  const bytes = Buffer.from(await result.arrayBuffer());
  const kinds = {
    bmp: ['image/bmp', bytes.length > 54 && bytes.subarray(0, 2).toString() === 'BM'],
    jpg: ['image/jpeg', bytes[0] === 255 && bytes[1] === 216],
    png: ['image/png', bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))],
    webp: [
      'image/webp',
      bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP',
    ],
  };
  const entry = Object.entries(kinds).find(([, [, valid]]) => valid);
  if (!entry || !bytes.length || bytes.length > 12000000)
    throw Error('Invalid image bytes from ' + new URL(url).hostname + ' (' + declared + ')');
  const [ext, [type]] = entry;
  if (declared?.startsWith('image/') && declared !== type && declared !== 'image/jpg')
    throw Error('Image media type does not match its bytes');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const file = sha256 + '.' + ext;
  await writeFile(join(output, 'assets', file), bytes);
  photoManifest[url] = { file, sha256, size: bytes.length, contentType: type };
}
await mkdir(dirname(join(output, 'recording.json')), { recursive: true });
await writeFile(join(output, 'recording.json'), JSON.stringify(record, null, 2) + '\n', {
  flag: 'wx',
});
await writeFile(join(output, 'media.json'), JSON.stringify(photoManifest, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    localImages: Object.keys(photoManifest).length,
    bytes: Object.values(photoManifest).reduce((sum, item) => sum + item.size, 0),
  }),
);

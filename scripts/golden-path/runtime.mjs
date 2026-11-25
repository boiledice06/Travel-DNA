import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const workspace = join(root, '.codex-temp', 'golden-path');
export const build = join(workspace, 'web');
export const fixtureDir = join(root, 'presentation', 'final', 'fixtures');
export const origin = 'http://127.0.0.1:8785';
const resetFile = join(workspace, 'epoch.txt');

export async function reset() {
  await mkdir(workspace, { recursive: true });
  const token = randomUUID();
  const staging = join(workspace, 'epoch-' + token + '.tmp');
  await writeFile(staging, token, { flag: 'wx' });
  await rename(staging, resetFile);
  return token;
}

export async function getEpoch() {
  const current = await readFile(resetFile, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  return current ?? reset();
}

import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

import type { RawFixture } from './fixture-format.ts';

const BASE = new URL('../../fixtures/netease/', import.meta.url);

export const readFixture = async (
  path: string,
  base = BASE,
): Promise<RawFixture> => {
  const bytes = await readFile(new URL(path, base));
  const text = path.endsWith('.gz')
    ? gunzipSync(bytes).toString('utf8')
    : bytes.toString('utf8');
  return JSON.parse(text) as RawFixture;
};

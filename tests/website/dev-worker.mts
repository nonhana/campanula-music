import { join } from 'node:path';
import process from 'node:process';

import { dev } from 'astro';
import { getCancelSignal, getOneMessage } from 'execa';

const signal = await getCancelSignal();
const root = (await getOneMessage()) as string;
const server = await dev({
  root: join(root, 'website'),
  cacheDir: join(root, 'astro-cache'),
  server: { host: '127.0.0.1', port: 4388 },
  vite: {
    cacheDir: join(root, 'vite-cache'),
    server: { strictPort: true, ws: { path: '/website-hmr' } },
  },
  devToolbar: { enabled: false },
});
const close = async () => {
  await server.stop();
  process.exit(0);
};
signal.addEventListener(
  'abort',
  () => {
    void close();
  },
  { once: true },
);
if (signal.aborted) await close();

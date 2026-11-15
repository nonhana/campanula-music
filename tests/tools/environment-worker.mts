import { realpath } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

import type { RunnableDevEnvironment } from 'vite';
import { createServer, mergeConfig } from 'vite';

import productConfig from '../../vite.config.mts';
import { mockPlugin } from '../_kit/mock/vite-plugin.ts';
import { startSsrCoverage } from '../coverage/ssr.ts';

process.once(
  'message',
  async ({
    mode,
    port,
    root,
  }: {
    mode: string;
    port: number;
    root: string;
  }) => {
    let server: Awaited<ReturnType<typeof createServer>> | undefined;
    let coverage: (() => Promise<void>) | undefined;
    let closing = false;
    const close = async () => {
      if (closing) return;
      closing = true;
      await server?.close();
      await coverage?.();
      process.exit(0);
    };
    process.once('SIGTERM', () => {
      void close();
    });
    process.once('SIGINT', () => {
      void close();
    });
    process.once('disconnect', () => {
      void close();
    });
    try {
      if (process.env.CAMPANULA_SSR_COVERAGE_DIR)
        coverage = await startSsrCoverage(
          process.env.CAMPANULA_SSR_COVERAGE_DIR,
        );
      server = await createServer(
        mergeConfig(productConfig, {
          configFile: false,
          root,
          envDir: root,
          cacheDir: 'node_modules/.vite',
          server: {
            host: mode === 'mock' ? '127.0.0.1' : 'localhost',
            port,
            strictPort: true,
            watch: { followSymlinks: false },
            fs: {
              allow: [
                root,
                await realpath(join(root, 'src')),
                new URL('../../', import.meta.url).pathname,
              ],
            },
          },
          plugins: mode === 'mock' ? [mockPlugin()] : [],
        }),
      );
      server.watcher.add(await realpath(join(root, 'src')));
      await server.listen();
      const address = server.httpServer!.address() as { port: number };
      const baseURL = `http://${mode === 'mock' ? '127.0.0.1' : 'localhost'}:${address.port}`;
      const runner = (server.environments.ssr as RunnableDevEnvironment).runner;
      const credentials = (await runner.import(
        new URL('../../src/lib/server/credentials.ts', import.meta.url)
          .pathname,
      )) as typeof import('../../src/lib/server/credentials.ts');
      const now = Date.now;
      let sessionCookie: string;
      try {
        Date.now = () => 0;
        sessionCookie = credentials.loginCookieHeader('synthetic-device', {
          MUSIC_U: 'synthetic-product-session',
        });
      } finally {
        Date.now = now;
      }
      process.send?.({ baseURL, sessionCookie });
    } catch (error) {
      console.error(error);
      process.send?.({ error: String(error) });
      await server?.close();
      await coverage?.();
      process.exit(1);
    }
  },
);

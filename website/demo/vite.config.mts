import { copyFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import UnoCSS from 'unocss/vite';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';

import uno from '../../uno.config.mts';

const output = resolve('../public/demo');

export default defineConfig({
  plugins: [
    ...((plugins: Plugin[]) => {
      for (const plugin of plugins) delete plugin.transformIndexHtml;
      return plugins;
    })(
      UnoCSS({
        ...uno,
        configFile: false,
        content: {
          filesystem: [
            resolve('../../src/lib/components/**/*.{svelte,ts}'),
            resolve('./**/*.{svelte,ts}'),
          ],
        },
      }),
    ),
    sveltekit({
      preprocess: vitePreprocess(),
      outDir: '.kit',
      compilerOptions: { rootDir: resolve('../..') },
      paths: { base: '/demo', relative: false },
      files: {
        src: '.',
        routes: './routes',
        assets: './static',
        params: '../../src/params.ts',
        appTemplate: './app.html',
      },
      serviceWorker: { register: false },
      adapter: {
        name: 'campanula-static-demo',
        async adapt(builder) {
          await rm(output, { recursive: true, force: true });
          builder.writeClient(output);
          await builder.generateFallback(resolve(output, 'index.html'));
          for (const path of ['playlists', 'playlists/501', 'playlists/502']) {
            await mkdir(resolve(output, path), { recursive: true });
            await copyFile(
              resolve(output, 'index.html'),
              resolve(output, path, 'index.html'),
            );
          }
        },
      },
    }),
  ],
});

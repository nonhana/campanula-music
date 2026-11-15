import process from 'node:process';

import adapterNode from '@sveltejs/adapter-node';
import adapterVercel from '@sveltejs/adapter-vercel';
import { getRequest } from '@sveltejs/kit/node';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import UnoCSS from 'unocss/vite';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';

const adapter = process.env.VERCEL
  ? adapterVercel({
      runtime: 'nodejs24.x',
      regions: ['hkg1'],
    })
  : adapterNode();

const externalOrigin = process.env.CAMPANULA_DEV_ORIGIN;
if (externalOrigin) {
  adapter.vite = {
    ...adapter.vite,
    getRequest: (options) => getRequest({ ...options, base: externalOrigin }),
  };
}

const developmentOrigin = (): Plugin => ({
  name: 'campanula:development-origin',
  enforce: 'pre',
  apply: 'serve',
  configureServer(server) {
    if (externalOrigin)
      server.printUrls = () =>
        server.config.logger.info(`  ➜  Local:   ${externalOrigin}/`);
    server.middlewares.use((req, res, next) => {
      const expected = externalOrigin
        ? new URL(externalOrigin).host
        : undefined;
      const host = req.headers.host ?? '';
      const hostname = host.split(':')[0];
      if (
        expected
          ? host === expected
          : hostname === (process.env.CAMPANULA_DEV_HOST ?? 'localhost')
      ) {
        next();
        return;
      }
      const destination =
        externalOrigin ??
        `http://${process.env.CAMPANULA_DEV_HOST ?? 'localhost'}:${server.config.server.port}`;
      res.statusCode = 421;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end(
        `请改用 ${destination}；切换主机需要重新登录，下载仍保存在原地址。`,
      );
    });
  },
});

export default defineConfig({
  server: {
    host: 'localhost',
    strictPort: true,
    ...(externalOrigin
      ? {
          origin: externalOrigin,
          allowedHosts: [new URL(externalOrigin).hostname],
          hmr: {
            protocol: 'wss',
            host: new URL(externalOrigin).hostname,
            clientPort: Number(new URL(externalOrigin).port || 443),
          },
        }
      : {}),
    watch: {
      ignored: ['**/_notes/**', '**/.reports/**', '**/.campanula/**'],
    },
  },
  plugins: [
    developmentOrigin(),
    // SvelteKit 没有 index.html，UnoCSS 的 transformIndexHtml 只会让每次读配置都警告一次（kit 3.1.0 关不掉）：摘掉它
    ...((plugins: Plugin[]): Plugin[] => {
      for (const plugin of plugins) delete plugin.transformIndexHtml;
      return plugins;
    })(UnoCSS()),
    sveltekit({
      preprocess: vitePreprocess(),
      adapter,
    }),
  ],
});

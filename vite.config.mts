import { resolve } from 'node:path';
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

const buildVersion =
  process.env.CAMPANULA_BUILD_VERSION ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  Date.now().toString();

const externalOrigin = process.env.CAMPANULA_DEV_ORIGIN;
const extraOrigins = (process.env.CAMPANULA_DEV_EXTRA_ORIGINS ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const externalOrigins = externalOrigin
  ? [externalOrigin, ...extraOrigins]
  : extraOrigins;
const allowedOriginMap = new Map(
  externalOrigins.map((origin) => [new URL(origin).host, origin]),
);

const requestAuthority = (req: {
  httpVersionMajor: number;
  headers: Record<string, string | string[] | undefined>;
}): string => {
  const authority =
    req.httpVersionMajor === 2 ? req.headers[':authority'] : req.headers.host;
  return typeof authority === 'string' ? authority : '';
};

if (externalOrigins.length > 0) {
  adapter.vite = {
    ...adapter.vite,
    getRequest: (options) => {
      const base =
        allowedOriginMap.get(requestAuthority(options.request)) ??
        externalOrigins[0]!;
      return getRequest({ ...options, base });
    },
  };
}

const developmentOrigin = (): Plugin => ({
  name: 'campanula:development-origin',
  enforce: 'pre',
  apply: 'serve',
  configureServer(server) {
    if (externalOrigins.length > 0)
      server.printUrls = () => {
        for (const origin of externalOrigins)
          server.config.logger.info(
            `  ➜  ${origin === externalOrigin ? 'Local:  ' : 'Network:'} ${origin}/`,
          );
      };
    server.middlewares.use((req, res, next) => {
      const host = requestAuthority(req);
      const hostname = host.split(':')[0];
      if (
        allowedOriginMap.size > 0
          ? allowedOriginMap.has(host)
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

const NOTO_BASE_PRUNED =
  /\/\*\s*noto-sans-(?:devanagari|cyrillic-ext|greek-ext|vietnamese)-wght-normal\s*\*\/\s*@font-face\s*\{[^}]*\}\s*/g;
const NOTO_CJK_SHADOWED =
  /\/\*\s*noto-sans-(?:sc|jp|tc)-(?:latin|latin-ext|cyrillic|vietnamese)-wght-normal\s*\*\/\s*@font-face\s*\{[^}]*\}\s*/g;

const pruneFonts = (): Plugin => ({
  name: 'campanula:prune-fonts',
  enforce: 'pre',
  transform(code, id) {
    const cleanId = id.split('?')[0]!;
    if (!cleanId.includes('@fontsource-variable/noto-sans')) return null;
    if (!cleanId.endsWith('.css')) return null;
    // 服务端不渲染页面（ssr = false），省略字体 CSS 避免向 build/server 重复输出 300+ woff2
    if (this.environment?.name === 'ssr') return { code: '', map: null };
    const next = /noto-sans-(?:sc|jp|tc)\//.test(cleanId)
      ? code.replace(NOTO_CJK_SHADOWED, '')
      : code.replace(NOTO_BASE_PRUNED, '');
    return next === code ? null : { code: next, map: null };
  },
});

export default defineConfig({
  define: { __CAMPANULA_BUILD_VERSION__: JSON.stringify(buildVersion) },
  environments: {
    client: {
      build: {
        rolldownOptions: {
          output: {
            codeSplitting: {
              groups: [
                {
                  name: 'kit-preload',
                  test: /(?:@sveltejs\/kit\/src\/runtime\/client\/payload\.js|vite\/preload-helper(?:\.js)?)$/,
                  priority: 40,
                },
                {
                  name: 'svelte',
                  test: /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?svelte\//,
                  priority: 35,
                },
                {
                  name: 'kit-runtime',
                  test: /@sveltejs\/kit\/src\/runtime\/(?!client\/(?:entry|payload)\.js$)/,
                  priority: 30,
                },
                {
                  name: 'icons',
                  test: /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?@lucide\/svelte\//,
                  priority: 25,
                },
                {
                  name: 'boot-shared',
                  test: /src\/lib\/components\/(?:shared\/(?!drag-sort|drag-scroll)|boot\/|svg\/|library\/home-view\.svelte\.|shell\/player-bar\.svelte\.|ui\/(?:Button|IconButton|StateBlock|control-styles)\.)/,
                  priority: 22,
                },
                {
                  name: 'app-core',
                  test: /src\/lib\/(?:api\/|app\/(?!song-info-core\.ts))/,
                  priority: 20,
                },
                {
                  name: 'ui-shared',
                  test: /src\/lib\/components\/(?:ui\/(?:Cover|Scrollbar|SearchField|Segmented|LongText|FilterChip|ToolButton|TextButton)\.|songs\/(?:SongTitle|CreditLine|DownloadMark|NowChip|PlayTarget|PlayAllButton|SongMoreButton|song-look)\.|library\/(?:SyncNotice|liked-failure|multi-select\.svelte|selection-core)\.|daily\/(?:DailyNumber|view)\.|overlay\/(?:overlays\.svelte|OverlayHost|overlay-context|overlay-stack|overlay-history\.svelte)\.|downloads\/panel\.svelte\.|player\/(?:PlayerLayer|player-layer\.svelte|cover-flight\.svelte|drawer|now|view)\.|shell\/(?:scroll-padding|player-dock|page-history|PageLocateButton|page-transition)\.|notice\/OfflineBar\.)/,
                  priority: 18,
                },
                {
                  name: 'shelf-ui',
                  test: /src\/lib\/components\/(?:library\/(?:TileGrid|CollectedGrid|PlaylistTile|PlaylistGrid|LibraryPageHead|tile-grid)\.|daily\/DailyTile\.|shared\/drag-scroll)/,
                  priority: 15,
                },
                {
                  name: 'song-list-ui',
                  test: /src\/lib\/components\/(?:songs\/(?:SongList|SongRow|SkeletonRows|view)\.|ui\/VirtualList\.|library\/(?:PlaylistSongs|selection-actions|DragGrip)\.)/,
                  priority: 15,
                },
                {
                  name: 'overlay-ui',
                  test: /src\/lib\/components\/(?:overlay\/(?:Dialog|Confirm|modal-focus)|menu\/(?:Menu|menu))/,
                  priority: 15,
                },
                {
                  name: 'player-bar-ui',
                  test: /src\/lib\/components\/player\/(?:CoverWheel|NowPlaying|PlayButton|PlayModeButton|ProgressLine|SeekLine|SongSwap|Volume|playhead|player-page|seek-slider|wheel-core)/,
                  priority: 15,
                },
                {
                  name: 'player-page-ui',
                  test: /src\/lib\/components\/player\/(?:CoverTint|Lyrics|QueueList|Skip|Wave|cover-swipe)/,
                  priority: 15,
                },
              ],
            },
          },
        },
      },
    },
    ssr: {
      build: {
        sourcemap: false,
        minify: true,
      },
    },
  },
  server: {
    host: 'localhost',
    strictPort: true,
    ...(externalOrigins.length > 0
      ? {
          ...(externalOrigins.length === 1
            ? { origin: externalOrigins[0] }
            : {}),
          allowedHosts: [
            ...new Set(
              externalOrigins.map((origin) => new URL(origin).hostname),
            ),
          ],
          hmr: {
            protocol: 'wss',
            ...(externalOrigins.length === 1
              ? { host: new URL(externalOrigins[0]!).hostname }
              : {}),
            clientPort: Number(new URL(externalOrigins[0]!).port || 443),
          },
        }
      : {}),
    watch: {
      ignored: ['**/_notes/**', '**/.reports/**', '**/.campanula/**'],
    },
  },
  plugins: [
    developmentOrigin(),
    pruneFonts(),
    // SvelteKit 没有 index.html，UnoCSS 的 transformIndexHtml 只会让每次读配置都警告一次（kit 3.1.0 关不掉）：摘掉它
    ...((plugins: Plugin[]): Plugin[] => {
      for (const plugin of plugins) delete plugin.transformIndexHtml;
      return plugins;
    })(UnoCSS()),
    sveltekit({
      preprocess: vitePreprocess(),
      inlineStyleThreshold: 4096,
      version: { name: buildVersion },
      compilerOptions: process.env.CAMPANULA_DEV_ROUTES
        ? { rootDir: resolve(process.env.CAMPANULA_DEV_ROUTES, '../..') }
        : undefined,
      files: process.env.CAMPANULA_DEV_ROUTES
        ? { routes: process.env.CAMPANULA_DEV_ROUTES }
        : undefined,
      adapter,
    }),
  ],
});

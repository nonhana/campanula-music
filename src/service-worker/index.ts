import { dev } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { self } from '$app/service-worker';

// 不加 skipWaiting：等所有标签页关掉再换版本，正在放的歌和正在看的那一页不被打断
declare const __CAMPANULA_BUILD_VERSION__: string;

const PREFIX = 'campanula-shell-';
const CACHE = `${PREFIX}${__CAMPANULA_BUILD_VERSION__}`;
const FONT_CACHE = 'campanula-fonts';
const resolved = (path: string): string =>
  new URL(path, self.location.href).pathname;
const isFontAsset = (path: string): boolean => path.endsWith('.woff2');
const SHELL = resolved('.');
const SHELL_ASSETS = [
  ...immutable.filter((entry) => !isFontAsset(entry.path)),
  ...assets,
].map((entry) => resolved(entry.path));
const SHELL_ASSET_SET = new Set(SHELL_ASSETS);
const FONT_ASSETS = new Set(
  immutable
    .filter((entry) => isFontAsset(entry.path))
    .map((entry) => resolved(entry.path)),
);

// 不缓存网络拿到的 HTML：它可能指着这份缓存里还没有的新构建产物
const navigate = async (request: Request): Promise<Response> => {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(CACHE);
    return (await cache.match(SHELL)) ?? Response.error();
  }
};

const cacheFirst = async (request: Request): Promise<Response> => {
  const cache = await caches.open(CACHE);
  return (await cache.match(request)) ?? fetch(request);
};

// 字体分片按需缓存并跨版本复用：内容哈希保证不可变，避免首访和发版强拉全部 CJK 分片
const fontCacheFirst = async (request: Request): Promise<Response> => {
  const cache = await caches.open(FONT_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) void cache.put(request, response.clone());
  return response;
};

const handleFetch = (event: FetchEvent): void => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') event.respondWith(navigate(request));
  else if (SHELL_ASSET_SET.has(url.pathname))
    event.respondWith(cacheFirst(request));
  else if (FONT_ASSETS.has(url.pathname))
    event.respondWith(fontCacheFirst(request));
};

if (!dev) {
  self.addEventListener('install', (event) => {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE);
        await cache.addAll([
          ...SHELL_ASSETS.map((path) => new Request(path)),
          new Request(SHELL, { cache: 'reload' }),
        ]);
      })(),
    );
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      (async () => {
        const names = await caches.keys();
        await Promise.all(
          names
            .filter((name) => name.startsWith(PREFIX) && name !== CACHE)
            .map((name) => caches.delete(name)),
        );
        if (names.includes(FONT_CACHE)) {
          const fonts = await caches.open(FONT_CACHE);
          const cached = await fonts.keys();
          await Promise.all(
            cached
              .filter(
                (request) => !FONT_ASSETS.has(new URL(request.url).pathname),
              )
              .map((request) => fonts.delete(request)),
          );
        }
        await self.clients.claim();
      })(),
    );
  });

  self.addEventListener('fetch', handleFetch);
}

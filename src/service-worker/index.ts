import { dev, version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { self } from '$app/service-worker';

// 不加 skipWaiting：等所有标签页关掉再换版本，正在放的歌和正在看的那一页不被打断
const PREFIX = 'campanula-shell-';
const CACHE = `${PREFIX}${version}`;
const resolved = (path: string): string =>
  new URL(path, self.location.href).pathname;
const SHELL = resolved('.');
const ASSETS = [...immutable, ...assets].map((entry) => resolved(entry.path));

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

const handleFetch = (event: FetchEvent): void => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') event.respondWith(navigate(request));
  else if (ASSETS.includes(url.pathname))
    event.respondWith(cacheFirst(request));
};

if (!dev) {
  self.addEventListener('install', (event) => {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE);
        await cache.addAll([
          ...ASSETS.map((path) => new Request(path)),
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
        await self.clients.claim();
      })(),
    );
  });

  self.addEventListener('fetch', handleFetch);
}

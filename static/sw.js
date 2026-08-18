/* 离线壳 service worker。
 *
 * 策略：应用外壳（页面导航 + 哈希静态资源）网络优先/缓存兜底，离线时回退
 * 最后访问的首页壳；/api 数据接口与 SvelteKit data 预取一律直连不缓存
 * （实时数据 + 凭据敏感）。音频流为跨域请求，本 SW 不代理。
 * 版本号变更即整体重建缓存。
 */
const SHELL_CACHE = 'campanula-shell-v1'

globalThis.addEventListener('install', () => {
  globalThis.skipWaiting()
})

globalThis.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter(key => key !== SHELL_CACHE).map(key => caches.delete(key)))
      await globalThis.clients.claim()
    })(),
  )
})

globalThis.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET')
    return
  const url = new URL(request.url)
  if (url.origin !== globalThis.location.origin)
    return

  // 数据通道：播放地址/歌单/搜索等实时数据与账号凭据相关，一律不缓存
  if (url.pathname.startsWith('/api/') || url.pathname.endsWith('/__data.json'))
    return

  // 页面导航：网络优先，离线时回退缓存的离线壳（最后访问的首页）
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request)
          const cache = await caches.open(SHELL_CACHE)
          cache.put(request, response.clone())
          return response
        }
        catch {
          const cached = await caches.match('/')
          return cached || Response.error()
        }
      })(),
    )
    return
  }

  // 静态资源（哈希文件/图标等）：缓存优先，后台更新（stale-while-revalidate）
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE)
      const cached = await cache.match(request)
      const pending = fetch(request)
        .then((response) => {
          if (response.ok)
            cache.put(request, response.clone())
          return response
        })
        .catch(() => cached || Response.error())
      return cached || pending
    })(),
  )
})

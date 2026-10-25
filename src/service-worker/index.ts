import { dev, version } from '$app/env'
import { assets, immutable } from '$app/manifest'
import { self } from '$app/service-worker'

// App 外壳的 Service Worker（Spec #11“客户端：App 外壳（PWA）”）：安装时把构建产物、static/ 和外壳页面整份存下来，
// 断网时打开、换页都还能用；新版本不 skipWaiting，等所有标签页关掉后再生效，正在放的歌和正在看的那一页都不被打断。

const PREFIX = 'campanula-shell-'
/** 每次构建一个缓存：构建产物按内容命名，旧的一整份删掉 */
const CACHE = `${PREFIX}${version}`
/** $app/manifest 给的是相对 base 的路径；Service Worker 里的地址都换成绝对路径，好和 request.url 比 */
const resolved = (path: string): string => new URL(path, self.location.href).pathname
/** 所有页面共用同一份外壳：断网时导航到哪里都回它，由 App 自己按地址画 */
const SHELL = resolved('.')
const ASSETS = [
  ...immutable,
  ...assets,
].map(entry => resolved(entry.path))

/**
 * 页面导航先走网络：打开 App 时用上部署后的新版本外壳。断网时用安装时存下的那一份；
 * 不把网络拿到的 HTML 存进来——它可能指着这份缓存里还没有的新构建产物
 */
const navigate = async (request: Request): Promise<Response> => {
  try {
    return await fetch(request)
  }
  catch {
    const cache = await caches.open(CACHE)
    return await cache.match(SHELL) ?? Response.error()
  }
}

/** 构建产物和 static/ 先看缓存：断网时页面的脚本、字体、图标都要能从这份缓存里拿出来 */
const cacheFirst = async (request: Request): Promise<Response> => {
  const cache = await caches.open(CACHE)
  return await cache.match(request) ?? fetch(request)
}

const handleFetch = (event: FetchEvent): void => {
  const { request } = event
  if (request.method !== 'GET')
    return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin)
    return
  if (request.mode === 'navigate')
    event.respondWith(navigate(request))
  else if (ASSETS.includes(url.pathname))
    event.respondWith(cacheFirst(request))
}

// 开发服务器每次改文件都换地址：不缓存，免得 HMR 拿到旧的一页；生产构建才管安装和断网
if (!dev) {
  self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE)
      // 外壳绕过 HTTP 缓存取一次：断网回退的那一份必须和这次构建的脚本对得上
      await cache.addAll([
        ...ASSETS.map(path => new Request(path)),
        new Request(SHELL, { cache: 'reload' }),
      ])
    })())
  })

  self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
      const names = await caches.keys()
      await Promise.all(names
        .filter(name => name.startsWith(PREFIX) && name !== CACHE)
        .map(name => caches.delete(name)))
      // 第一次装上就能接管已经打开的页面，下一次换页、断网时也用得上缓存
      await self.clients.claim()
    })())
  })

  self.addEventListener('fetch', handleFetch)
}

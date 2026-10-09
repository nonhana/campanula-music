/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// 验证关卡③的 Service Worker：
// - 缓存页面外壳（构建产物、static 里的文件；页面导航先走网络，断网时用缓存的外壳），让探针能装成 WebAPK；
// - 收 Background Fetch 的结果：存进 Cache Storage，记下当时开着几个窗口（0 个就是 App 已经关掉了）；
// - 接力下载：前一首完成时，在这里取下一首的地址、开下一个后台任务。

import type { BgItem, RelayPlan } from '$lib/probe/download'
import { DOWNLOAD_CACHE, downloadKey, mimeOf, startRelayStep } from '$lib/probe/download'
import { addLog, errorText, kvGet } from '$lib/probe/log'
import { songName } from '$lib/probe/songs'
import { build, files, version } from '$service-worker'

const sw = globalThis as unknown as ServiceWorkerGlobalScope

const SHELL_CACHE = `shell-${version}`
const SHELL_KEY = '/__shell'
const ASSETS = new Set([...build, ...files])

sw.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll([...ASSETS])).then(() => sw.skipWaiting()))
})

sw.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('shell-') && key !== SHELL_CACHE)
        await caches.delete(key)
    }
    await sw.clients.claim()
  })())
})

sw.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET')
    return
  const url = new URL(request.url)
  if (url.origin !== sw.location.origin || url.pathname.startsWith('/api/'))
    return
  if (ASSETS.has(url.pathname)) {
    event.respondWith(caches.match(url.pathname, { cacheName: SHELL_CACHE }).then(hit => hit ?? fetch(request)))
    return
  }
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE)
      try {
        const response = await fetch(request)
        // ssr 关着，每个页面的 HTML 都是同一个外壳，随便存一份就能在断网时打开任何页面
        if (response.ok)
          await cache.put(SHELL_KEY, response.clone())
        return response
      }
      catch (error) {
        const shell = await cache.match(SHELL_KEY)
        if (shell)
          return shell
        throw error
      }
    })())
  }
})

/** 记一笔，并记下当时开着几个窗口；记完叫开着的页面刷新记录。 */
async function swLog(kind: string, detail?: unknown): Promise<void> {
  const windows = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const where = windows.length === 0 ? '没有窗口' : `${windows.length} 个窗口（${windows.map(client => client.visibilityState).join('、')}）`
  await addLog({ at: Date.now(), source: 'sw', topic: 'download', kind, detail, where })
  for (const client of windows)
    client.postMessage({ type: 'probe-log' })
}

function regInfo(registration: BackgroundFetchRegistration) {
  return {
    id: registration.id,
    downloaded: registration.downloaded,
    downloadTotal: registration.downloadTotal,
    result: registration.result,
    failureReason: registration.failureReason,
  }
}

/** 把一个后台任务里拿到的歌存进 Cache Storage，返回存下的歌曲编号。 */
async function saveRecords(registration: BackgroundFetchRegistration): Promise<number[]> {
  const items = await kvGet<BgItem[]>(`bg:${registration.id}`) ?? []
  const cache = await caches.open(DOWNLOAD_CACHE)
  const saved: number[] = []
  for (const record of await registration.matchAll()) {
    const item = items.find(candidate => new URL(candidate.url).href === record.request.url)
    try {
      const response = await record.responseReady
      if (!item || !response.ok) {
        await swLog('这一首没存', { reg: registration.id, status: response.status, known: Boolean(item) })
        continue
      }
      const blob = await response.blob()
      await cache.put(downloadKey(item.id), new Response(blob, {
        headers: {
          'content-type': mimeOf(item.type),
          'x-probe-bytes': String(blob.size),
          'x-probe-at': String(Date.now()),
          'x-probe-reg': registration.id,
        },
      }))
      saved.push(item.id)
    }
    catch (error) {
      await swLog('这一首没存', { reg: registration.id, song: item && songName(item.id), error: errorText(error) })
    }
  }
  return saved
}

/** 接力：刚完成的是当前这一棒、后面还有歌，就开下一棒。 */
async function relayNext(registration: BackgroundFetchRegistration): Promise<string | undefined> {
  const plan = await kvGet<RelayPlan | null>('relay')
  if (!plan || plan.regId !== registration.id)
    return undefined
  const nextIndex = plan.index + 1
  if (nextIndex >= plan.ids.length) {
    await swLog('接力：全部下完', { planId: plan.planId, songs: plan.ids.length })
    return `接力完成，共 ${plan.ids.length} 首`
  }
  const manager = sw.registration.backgroundFetch
  if (!manager) {
    await swLog('接力：Service Worker 里没有 backgroundFetch')
    return undefined
  }
  try {
    const next = await startRelayStep(manager, plan, nextIndex, swLog)
    await swLog('接力：开了下一棒', { regId: next.regId, song: songName(plan.ids[nextIndex]!) })
    return `第 ${plan.index + 1}/${plan.ids.length} 首已下完，接着下一首`
  }
  catch (error) {
    await swLog('接力：开下一棒失败', { song: songName(plan.ids[nextIndex]!), error: errorText(error) })
    return `第 ${plan.index + 1}/${plan.ids.length} 首已下完，下一首没能开始`
  }
}

sw.addEventListener('backgroundfetchsuccess', (event) => {
  event.waitUntil((async () => {
    const saved = await saveRecords(event.registration)
    await swLog('后台任务完成', { ...regInfo(event.registration), saved: saved.map(songName) })
    const relay = await relayNext(event.registration)
    await event.updateUI({ title: relay ?? `已下完 ${saved.length} 首` })
  })())
})

sw.addEventListener('backgroundfetchfail', (event) => {
  event.waitUntil((async () => {
    const saved = await saveRecords(event.registration)
    await swLog('后台任务失败', { ...regInfo(event.registration), saved: saved.map(songName) })
    await event.updateUI({ title: `下载失败（${event.registration.failureReason}）` })
  })())
})

sw.addEventListener('backgroundfetchabort', (event) => {
  event.waitUntil(swLog('后台任务被取消', regInfo(event.registration)))
})

sw.addEventListener('backgroundfetchclick', (event) => {
  event.waitUntil((async () => {
    await swLog('点了下载通知', regInfo(event.registration))
    await sw.clients.openWindow('/probe/download')
  })())
})

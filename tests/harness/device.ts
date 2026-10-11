import type { App } from '$lib/app/app'
import type { BrowserCapabilities, Clock } from '$lib/app/browser'
import type { Cookie } from 'tough-cookie'
import { createApp } from '$lib/app/app'
import { IDBFactory } from 'fake-indexeddb'
import { CookieJar } from 'tough-cookie'
import { FakeBroadcast, FakeLocks, FakeMediaMetadata, FakeMediaSession, FakeNetwork, FakePage, FakeStorage } from './browser'

export interface SentRequest {
  method: string
  path: string
}

/** 一个标签页：一个 App，加上只属于这个标签页的页面可见性和 Media Session */
export interface Tab {
  app: App
  /** 页面被隐藏（切到别的应用、锁屏） */
  hide: () => void
  /** 页面回到前台 */
  show: () => void
  mediaSession: FakeMediaSession
}

/** 一台设备上的浏览器：Cookie、本机数据库、跨标签页的锁和广播、联网状态和存储空间，开出来的标签页共用 */
export interface Device {
  /** 打开一个标签页，等 App 打开完 */
  open: () => Promise<Tab>
  /** 这台设备向 Campanula 服务端发出的请求，按先后；断网时没发出去的不算 */
  readonly requests: readonly SentRequest[]
  /** 这台设备收到的服务端响应正文，按先后：页面脚本能读到的就是这些 */
  readonly responseBodies: readonly string[]
  /** 这台设备存着的 Cookie（包括 httpOnly 的） */
  cookies: () => Promise<Cookie[]>
  /** 像有人在浏览器里手动改了 Cookie：按 Set-Cookie 的写法存进这台设备 */
  setCookie: (setCookie: string) => Promise<void>
  /** 断网或联网：navigator.onLine 跟着变、发 offline / online 事件；断网时请求直接失败 */
  setOnline: (online: boolean) => void
  /** 存储空间：已用、配额、persist() 会不会被同意，测试可以改 */
  storage: FakeStorage
  /** 等这台设备上正在发的请求都回来、标签页之间的广播都送到、App 处理完（处理时又发的请求、广播也等） */
  idle: () => Promise<void>
}

/** origin：测试进程里服务端的地址；clock：世界的时钟 */
export function createDevice(origin: string, clock: Clock): Device {
  const jar = new CookieJar()
  const requests: SentRequest[] = []
  const responseBodies: string[] = []
  const indexedDB = new IDBFactory()
  const network = new FakeNetwork()
  const storage = new FakeStorage()
  const locks = new FakeLocks()
  const broadcast = new FakeBroadcast()
  const inFlight = new Set<Promise<Response>>()

  // 和浏览器的同源请求一样：带上这台设备的 Cookie，存下服务端设的 Cookie
  async function send(path: string, init?: RequestInit): Promise<Response> {
    if (!network.onLine)
      throw new TypeError('Failed to fetch')
    const request = new Request(new URL(path, origin), init)
    const url = new URL(request.url)
    requests.push({ method: request.method, path: url.pathname + url.search })
    const cookie = await jar.getCookieString(request.url)
    if (cookie)
      request.headers.set('cookie', cookie)
    const response = await fetch(request)
    for (const setCookie of response.headers.getSetCookie())
      await jar.setCookie(setCookie, response.url)
    responseBodies.push(await response.clone().text())
    return response
  }

  const deviceFetch: BrowserCapabilities['fetch'] = (path, init) => {
    const sending = send(path, init)
    inFlight.add(sending)
    void sending.catch(() => {}).finally(() => inFlight.delete(sending))
    return sending
  }

  return {
    requests,
    responseBodies,
    async open() {
      const page = new FakePage()
      const mediaSession = new FakeMediaSession()
      const app = createApp({
        fetch: deviceFetch,
        clock,
        indexedDB,
        network,
        page,
        storage,
        mediaSession,
        MediaMetadata: FakeMediaMetadata,
        locks,
        broadcastChannel: broadcast.channel,
      })
      await app.open()
      return {
        app,
        hide: () => page.set('hidden'),
        show: () => page.set('visible'),
        mediaSession,
      }
    },
    cookies: () => jar.getCookies(origin),
    setCookie: async (setCookie) => {
      await jar.setCookie(setCookie, origin)
    },
    setOnline: online => network.set(online),
    storage,
    async idle() {
      while (inFlight.size > 0 || broadcast.pending > 0) {
        await Promise.allSettled(inFlight)
        // 让 App 处理完回来的结果（微任务）、送达广播（宏任务）；处理时又发了请求或广播就接着等
        await new Promise(resolve => setImmediate(resolve))
      }
    },
  }
}

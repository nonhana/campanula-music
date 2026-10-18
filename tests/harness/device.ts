import type { Cookie } from 'tough-cookie'
import type { App } from '#lib/app/app.js'
import type { BrowserCapabilities, ChannelCapability, Clock, NetworkStatus } from '#lib/app/browser.js'
import { IDBDatabase, IDBFactory } from 'fake-indexeddb'
import { CookieJar } from 'tough-cookie'
import { createApp } from '#lib/app/app.js'
import { FakeAudio, FakeBroadcast, FakeLocks, FakeMediaMetadata, FakeMediaSession, FakeNetwork, FakePage, FakeStorage, MediaTasks } from './browser'

export interface SentRequest {
  method: string
  path: string
  /** 请求体（JSON），没有就不写 */
  body?: unknown
}

/** 一个标签页：一个 App，加上只属于这个标签页的页面可见性、Media Session 和播放器 */
export interface Tab {
  app: App
  /** 页面被隐藏（切到别的应用、锁屏） */
  hide: () => void
  /** 页面回到前台 */
  show: () => void
  /**
   * 关掉这个标签页（关掉浏览器标签页、划掉 App）：页面先被隐藏，之后页面里的脚本不再运行：
   * 播放器停下不出声、不再发事件，定时不再触发，收不到广播和联网状态的变化。
   * 依据 HTML 标准的 unload a document（先发 visibilitychange 变成 hidden）和 destroy a document（排着的任务丢掉，事件循环不再为它跑任务）。
   * 替身没做到的：在路上的请求、排着的锁、本机数据库的连接不会跟着断，所以关之前先等设备停下（world.settle）
   */
  close: () => void
  mediaSession: FakeMediaSession
  /** 这个标签页的播放器，按 App 新建的先后 */
  audio: readonly FakeAudio[]
  /** 正在出声的播放器；没有就是 undefined */
  sounding: () => FakeAudio | undefined
}

/** 一台设备上的浏览器：Cookie、本机数据库、跨标签页的锁和广播、联网状态和存储空间，开出来的标签页共用 */
export interface Device {
  /** 打开一个标签页，等 App 打开完 */
  open: () => Promise<Tab>
  /** 这台设备向 Campanula 服务端发出的请求，按先后；断网时没发出去的不算 */
  readonly requests: readonly SentRequest[]
  /** 发出去了、还没收完响应的请求，按发出的先后 */
  readonly pending: readonly SentRequest[]
  /** 这台设备收到的服务端响应正文，按先后：页面脚本能读到的就是这些 */
  readonly responseBodies: readonly string[]
  /** 这台设备存着的 Cookie（包括 httpOnly 的） */
  cookies: () => Promise<Cookie[]>
  /** 像有人在浏览器里手动改了 Cookie：按 Set-Cookie 的写法存进这台设备 */
  setCookie: (setCookie: string) => Promise<void>
  /** 这台设备的本机数据库里 Campanula 存了什么：每个存储区里的 [键, 值]，按键排；还没建库时是空对象 */
  stored: () => Promise<Record<string, [IDBValidKey, unknown][]>>
  /** 断网或联网：navigator.onLine 跟着变、发 offline / online 事件；断网时请求直接失败 */
  setOnline: (online: boolean) => void
  /** 存储空间：已用、配额、persist() 会不会被同意，测试可以改 */
  storage: FakeStorage
  /**
   * 等这台设备上正在发的请求都回来、排着的锁回调、标签页之间的广播和播放器的事件都跑完、本机数据库的读写都做完、
   * App 处理完（处理时又发的也等）
   */
  idle: () => Promise<void>
  /** 除了在路上的请求（pending），还有没做完的事：本机数据库事务、排着的锁回调、没送到的广播、播放器排着的事件 */
  busy: () => boolean
}

/** App 在本机数据库里用的库名（src/lib/app/local.ts），在浏览器的开发者工具里看到的就是它 */
const LOCAL_DB = 'campanula'

/**
 * 本机数据库正在做的事务：fake-indexeddb 一个请求一个任务（setImmediate）地做，几千首歌的写入要很多轮，
 * 只等一轮的话 App 还没写完、还没发下一个请求，idle() 就回来了。所有设备共用一个计数
 */
let activeTransactions = 0
const transaction = IDBDatabase.prototype.transaction
IDBDatabase.prototype.transaction = function (this: IDBDatabase, ...args: Parameters<IDBDatabase['transaction']>) {
  const started = transaction.apply(this, args)
  activeTransactions += 1
  const finished = () => {
    activeTransactions -= 1
  }
  // 出错的事务最后也会 abort（IndexedDB 3.0 §5.6 abort a transaction）
  started.addEventListener('complete', finished)
  started.addEventListener('abort', finished)
  return started
}

/** 读请求体：App 只发 JSON */
function bodyOf(init: RequestInit | undefined): Pick<SentRequest, 'body'> {
  return typeof init?.body === 'string' ? { body: JSON.parse(init.body) as unknown } : {}
}

/** 请求头：App 发出这个请求时的序号（stamp），服务端按它记请求是什么时候发出的（world.ts，网易云替身查对不上号用） */
export const SENT_HEADER = 'x-test-sent'

/** origin：测试进程里服务端的地址；clock：世界的时钟；stamp：取一个只增不减的序号（网易云替身的 nextOrder） */
export function createDevice(origin: string, clock: Clock, stamp: () => number): Device {
  const jar = new CookieJar()
  const requests: SentRequest[] = []
  const pending: SentRequest[] = []
  const responseBodies: string[] = []
  const indexedDB = new IDBFactory()
  const network = new FakeNetwork()
  const storage = new FakeStorage()
  const locks = new FakeLocks()
  const broadcast = new FakeBroadcast()
  const mediaTasks = new MediaTasks()
  const inFlight = new Set<Promise<unknown>>()

  function track(work: Promise<unknown>): void {
    inFlight.add(work)
    void work.catch(() => {}).finally(() => inFlight.delete(work))
  }

  // 打开数据库（包括升级）也是在任务里一步步做的，做完之前同样算 App 没处理完
  const deviceIndexedDB = Object.create(indexedDB) as IDBFactory
  deviceIndexedDB.open = (name, version) => {
    const request = indexedDB.open(name, version)
    track(new Promise((resolve) => {
      request.addEventListener('success', resolve)
      request.addEventListener('error', resolve)
    }))
    return request
  }

  // 和浏览器的同源请求一样：带上这台设备的 Cookie，存下服务端设的 Cookie
  async function send(path: string, init?: RequestInit): Promise<Response> {
    // App 调 fetch 的这一刻就盖上序号（下面一 await，几个同时发的请求到服务端的先后就不定了）
    const sentAt = stamp()
    if (!network.onLine)
      throw new TypeError('Failed to fetch')
    const request = new Request(new URL(path, origin), init)
    request.headers.set(SENT_HEADER, String(sentAt))
    const url = new URL(request.url)
    const sent: SentRequest = { method: request.method, path: url.pathname + url.search, ...bodyOf(init) }
    requests.push(sent)
    pending.push(sent)
    try {
      const cookie = await jar.getCookieString(request.url)
      if (cookie)
        request.headers.set('cookie', cookie)
      const response = await fetch(request)
      for (const setCookie of response.headers.getSetCookie())
        await jar.setCookie(setCookie, response.url)
      responseBodies.push(await response.clone().text())
      return response
    }
    finally {
      pending.splice(pending.indexOf(sent), 1)
    }
  }

  const busy = () => activeTransactions > 0 || locks.pending > 0 || broadcast.pending > 0 || mediaTasks.pending > 0

  const deviceFetch: BrowserCapabilities['fetch'] = (path, init) => {
    const sending = send(path, init)
    track(sending)
    return sending
  }

  return {
    requests,
    pending,
    responseBodies,
    async open() {
      const page = new FakePage()
      const mediaSession = new FakeMediaSession()
      const audio: FakeAudio[] = []
      // 关掉以后页面里的脚本不再运行：定时、广播、联网状态的变化都送不到这个标签页
      let closed = false
      const alive = (callback: () => void) => () => {
        if (!closed)
          callback()
      }
      const channels: ChannelCapability[] = []
      /** 按事件类型，App 加的监听 → 实际挂在设备上的那个 */
      const networkListeners = { online: new Map<() => void, () => void>(), offline: new Map<() => void, () => void>() }
      const tabNetwork: NetworkStatus = {
        get onLine() {
          return network.onLine
        },
        addEventListener(type, listener) {
          const gated = networkListeners[type].get(listener) ?? alive(listener)
          networkListeners[type].set(listener, gated)
          network.addEventListener(type, gated)
        },
        removeEventListener(type, listener) {
          const gated = networkListeners[type].get(listener)
          if (gated)
            network.removeEventListener(type, gated)
          networkListeners[type].delete(listener)
        },
      }
      const app = createApp({
        fetch: deviceFetch,
        clock: { now: clock.now, after: (ms, callback) => clock.after(ms, alive(callback)) },
        indexedDB: deviceIndexedDB,
        network: tabNetwork,
        page,
        storage,
        mediaSession,
        MediaMetadata: FakeMediaMetadata,
        locks,
        broadcastChannel: (name) => {
          const channel = broadcast.channel(name)
          channels.push(channel)
          return channel
        },
        audio: () => {
          const player = new FakeAudio(mediaTasks)
          audio.push(player)
          return player
        },
      })
      await app.open()
      return {
        app,
        hide: () => page.set('hidden'),
        show: () => page.set('visible'),
        close: () => {
          page.set('hidden')
          closed = true
          for (const player of audio)
            player.close()
          for (const channel of channels)
            channel.close()
        },
        mediaSession,
        audio,
        sounding: () => audio.find(player => player.sounding),
      }
    },
    cookies: () => jar.getCookies(origin),
    setCookie: async (setCookie) => {
      await jar.setCookie(setCookie, origin)
    },
    async stored() {
      if (!(await indexedDB.databases()).some(info => info.name === LOCAL_DB))
        return {}
      // 再开一个连接来读，和 App 的连接同时开着，就像在开发者工具里看
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(LOCAL_DB)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const names = [...database.objectStoreNames]
      const transaction = database.transaction(names)
      const read = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const contents = await Promise.all(names.map(async (name) => {
        const store = transaction.objectStore(name)
        const [keys, values] = await Promise.all([read(store.getAllKeys()), read(store.getAll())])
        return [name, keys.map((key, index) => [key, values[index]] as [IDBValidKey, unknown])] as const
      }))
      database.close()
      return Object.fromEntries(contents)
    },
    setOnline: online => network.set(online),
    storage,
    async idle() {
      // 先让一轮：刚调的 App 操作可能还没来得及发请求、开事务
      do {
        await Promise.allSettled(inFlight)
        // 让 App 处理完回来的结果（微任务）、跑完数据库事务、锁回调和广播（任务）；处理时又发了请求、事务、锁或广播就接着等
        await new Promise(resolve => setImmediate(resolve))
      } while (inFlight.size > 0 || busy())
    },
    busy,
  }
}

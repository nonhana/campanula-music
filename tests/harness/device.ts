import type { App } from '$lib/app/app'
import type { BrowserCapabilities, Clock } from '$lib/app/browser'
import type { Cookie } from 'tough-cookie'
import { createApp } from '$lib/app/app'
import { IDBDatabase, IDBFactory } from 'fake-indexeddb'
import { CookieJar } from 'tough-cookie'
import { FakeBroadcast, FakeLocks, FakeMediaMetadata, FakeMediaSession, FakeNetwork, FakePage, FakeStorage } from './browser'

export interface SentRequest {
  method: string
  path: string
  /** 请求体（JSON），没有就不写 */
  body?: unknown
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
   * 等这台设备上正在发的请求都回来、排着的锁回调和标签页之间的广播都跑完、本机数据库的读写都做完、
   * App 处理完（处理时又发的也等）
   */
  idle: () => Promise<void>
  /** 除了在路上的请求（pending），还有没做完的事：本机数据库事务、排着的锁回调、没送到的广播 */
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

/** origin：测试进程里服务端的地址；clock：世界的时钟 */
export function createDevice(origin: string, clock: Clock): Device {
  const jar = new CookieJar()
  const requests: SentRequest[] = []
  const pending: SentRequest[] = []
  const responseBodies: string[] = []
  const indexedDB = new IDBFactory()
  const network = new FakeNetwork()
  const storage = new FakeStorage()
  const locks = new FakeLocks()
  const broadcast = new FakeBroadcast()
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
    if (!network.onLine)
      throw new TypeError('Failed to fetch')
    const request = new Request(new URL(path, origin), init)
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

  const busy = () => activeTransactions > 0 || locks.pending > 0 || broadcast.pending > 0

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
      const app = createApp({
        fetch: deviceFetch,
        clock,
        indexedDB: deviceIndexedDB,
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

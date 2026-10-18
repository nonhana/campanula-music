/**
 * App 用到的浏览器能力。App 只从这里拿，不直接用 window、navigator、document 这些全局对象，
 * 测试接入点里整个换成替身（Spec #11 Testing Decisions）。
 * 浏览器直连网易云的传输（#34、#38）、Background Fetch（#41）由最早用到它们的票加上。
 */
export interface BrowserCapabilities {
  /** 向 Campanula 自己的服务端发请求：同源，浏览器自动带上 Cookie；断网时失败 */
  fetch: (path: string, init?: RequestInit) => Promise<Response>
  clock: Clock
  /** 本机数据库：同一个浏览器里的标签页共用 */
  indexedDB: IDBFactory
  network: NetworkStatus
  page: PageVisibility
  storage: StorageCapability
  mediaSession: MediaSessionCapability
  MediaMetadata: typeof MediaMetadata
  /** 跨标签页的锁，同 navigator.locks：同一浏览器里同源的标签页共用 */
  locks: LocksCapability
  /** 打开一个跨标签页的广播频道，同 new BroadcastChannel(name)：同一浏览器里同源、同名的频道互相收得到，自己发的自己收不到 */
  broadcastChannel: (name: string) => ChannelCapability
  /** 新建一个播放器，同 new Audio()：浏览器直连网易云的音频服务器放歌 */
  audio: () => AudioCapability
  /**
   * 收藏歌单前现取一枚网易云的反作弊令牌（#30 留言）：网易云官方的 Watchman（网易易盾）给的，页面里只初始化一次，
   * 每次都重新取，不缓存、不复用。令牌随请求交给服务端，服务端只透传给 SDK。Watchman 没加载出来（断网、被浏览器插件拦了）、
   * 迟迟不给时失败
   */
  checkToken: () => Promise<string>
}

/** 播放器发的事件里 App 用到的 */
export type AudioEvent = 'playing' | 'waiting' | 'pause' | 'timeupdate' | 'durationchange' | 'canplaythrough' | 'ended' | 'error'

/** 一个播放器（<audio>）里 App 用到的部分，照 HTML 标准的 HTMLMediaElement */
export interface AudioCapability {
  /** 换地址就重新加载：停下、进度回到 0、还没了结的 play() 以 AbortError 失败 */
  src: string
  /** 秒。还没加载出来时设的值，加载出来后从这里开始放 */
  currentTime: number
  /** 秒；还不知道时是 NaN */
  readonly duration: number
  readonly paused: boolean
  /** 放到头了 */
  readonly ended: boolean
  /** 0 到 1 */
  volume: number
  preload: '' | 'none' | 'metadata' | 'auto'
  /** 加载或解码出错；MediaError 的 code：2 是网络出错，4 是地址放不了 */
  readonly error: { readonly code: number } | null
  /** 开始放：出声了才成功；在那之前暂停、换地址就以 AbortError 失败，地址放不了以 NotSupportedError 失败 */
  play: () => Promise<void>
  pause: () => void
  addEventListener: (type: AudioEvent, listener: () => void) => void
}

/** 跨标签页的锁（Web Locks） */
export type LocksCapability = Pick<LockManager, 'request'>

/** 跨标签页的广播频道：收到消息时发 message 事件（MessageEvent，消息在 data 里） */
export type ChannelCapability = Pick<BroadcastChannel, 'postMessage' | 'addEventListener' | 'close'>

/** 存储空间，同 navigator.storage */
export type StorageCapability = Pick<StorageManager, 'estimate' | 'persist' | 'persisted'>

/** 锁屏和通知栏上的播放控件，同 navigator.mediaSession；歌曲信息用 BrowserCapabilities.MediaMetadata 构造 */
export type MediaSessionCapability = Pick<MediaSession, 'metadata' | 'playbackState' | 'setActionHandler' | 'setPositionState'>

export interface Clock {
  /** 现在的时间，毫秒，同 Date.now() */
  now: () => number
  /** 过 ms 毫秒后做 callback，返回取消函数 */
  after: (ms: number, callback: () => void) => () => void
}

/** 联网状态：onLine 同 navigator.onLine，变化时发 online / offline 事件 */
export interface NetworkStatus {
  readonly onLine: boolean
  addEventListener: (type: 'online' | 'offline', listener: () => void) => void
  removeEventListener: (type: 'online' | 'offline', listener: () => void) => void
}

/** 页面可见性：同 document.visibilityState，变化时发 visibilitychange */
export interface PageVisibility {
  readonly visibilityState: DocumentVisibilityState
  addEventListener: (type: 'visibilitychange', listener: () => void) => void
  removeEventListener: (type: 'visibilitychange', listener: () => void) => void
}

/** 网易云官方的 Watchman：脚本、产品号，和收藏歌单用的业务编号（官方网页版用的这一组，hana-music-api#77 在真账号上验证过） */
const WATCHMAN = {
  script: 'https://acstatic-dun.126.net/tool.min.js',
  product: 'YD00000558929251',
  business: 'bd5d2f973ef74cd2a61325a412ae54d9',
  /** 加载、取令牌最多等这么久（毫秒）：网络慢、被拦了时不干等 */
  timeout: 10_000,
}

interface Watchman {
  getToken: (business: string, callback: (token: string) => void) => void
}

declare global {
  interface Window {
    initWatchman?: (options: { auto: boolean, productNumber: string, protocol: string, onload: (instance?: Watchman) => void, onerror: (error: unknown) => void }) => void
    WM?: Watchman
  }
}

function withTimeout<T>(work: Promise<T>, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${what}超时`)), WATCHMAN.timeout)
    work.then(resolve, reject).finally(() => window.clearTimeout(timer))
  })
}

/** 页面里 Watchman 的脚本：只加载一次；没加载出来时下次再试 */
let watchmanScript: Promise<void> | undefined
function loadWatchmanScript(): Promise<void> {
  watchmanScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = WATCHMAN.script
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      script.remove()
      reject(new Error('Watchman 的脚本没加载出来'))
    }
    document.head.append(script)
  }).catch((error: unknown) => {
    watchmanScript = undefined
    throw error
  })
  return watchmanScript
}

/**
 * 页面里的 Watchman：整个页面只初始化一次，之后一直用这一个（每次新建等于换一台设备，网易云会回 405，#30 留言）。
 * 初始化没成（网络、被拦）时下次再试；已经有 window.WM 就直接用它
 */
let watchman: Promise<Watchman> | undefined
function loadWatchman(): Promise<Watchman> {
  watchman ??= withTimeout(loadWatchmanScript().then(() => window.WM ?? new Promise<Watchman>((resolve, reject) => window.initWatchman!({
    auto: true,
    productNumber: WATCHMAN.product,
    protocol: 'https',
    onload: (instance) => {
      const ready = instance ?? window.WM
      if (ready)
        resolve(ready)
      else
        reject(new Error('Watchman 初始化了，但没有给出实例'))
    },
    onerror: reject,
  }))), '加载 Watchman ').catch((error: unknown) => {
    watchman = undefined
    throw error
  })
  return watchman
}

async function watchmanToken(): Promise<string> {
  const instance = await loadWatchman()
  const token = await withTimeout(new Promise<string>(resolve => instance.getToken(WATCHMAN.business, resolve)), '取反作弊令牌')
  if (!token)
    throw new Error('Watchman 给了一个空的令牌')
  return token
}

export function realBrowserCapabilities(): BrowserCapabilities {
  return {
    fetch: (path, init) => window.fetch(path, init),
    clock: {
      now: () => Date.now(),
      after(ms, callback) {
        const id = window.setTimeout(callback, ms)
        return () => window.clearTimeout(id)
      },
    },
    indexedDB: window.indexedDB,
    network: {
      get onLine() {
        return navigator.onLine
      },
      addEventListener: (type, listener) => window.addEventListener(type, listener),
      removeEventListener: (type, listener) => window.removeEventListener(type, listener),
    },
    page: document,
    storage: navigator.storage,
    mediaSession: navigator.mediaSession,
    MediaMetadata: window.MediaMetadata,
    locks: navigator.locks,
    broadcastChannel: name => new BroadcastChannel(name),
    audio: () => new Audio(),
    checkToken: watchmanToken,
  }
}

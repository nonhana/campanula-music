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
  }
}

import type { Clock, MediaSessionCapability, NetworkStatus, PageVisibility, StorageCapability } from '$lib/app/browser'
import type { Clock as FakeTimers } from '@sinonjs/fake-timers'

// 风险低的浏览器能力替身：行为照浏览器标准，几乎没有要猜的地方。
// 音频、Web Locks、浏览器直连网易云的传输、Background Fetch 由最早用到它们的票加上。

/** App 的时钟：和世界的假时钟走同一个时间，定时按到期先后触发 */
export function clockOn(timers: FakeTimers): Clock {
  return {
    now: () => timers.now,
    after(ms, callback) {
      const id = timers.setTimeout(callback, ms)
      return () => timers.clearTimeout(id)
    },
  }
}

/** 联网状态：一台设备一个，所有标签页共用；只在真的变了时发事件 */
export class FakeNetwork extends EventTarget implements NetworkStatus {
  #onLine = true

  get onLine(): boolean {
    return this.#onLine
  }

  set(online: boolean): void {
    if (online === this.#onLine)
      return
    this.#onLine = online
    this.dispatchEvent(new Event(online ? 'online' : 'offline'))
  }
}

/** 页面可见性：一个标签页一个 */
export class FakePage extends EventTarget implements PageVisibility {
  #state: DocumentVisibilityState = 'visible'

  get visibilityState(): DocumentVisibilityState {
    return this.#state
  }

  set(state: DocumentVisibilityState): void {
    if (state === this.#state)
      return
    this.#state = state
    this.dispatchEvent(new Event('visibilitychange'))
  }
}

/** 存储空间：已用和配额由测试设定，不会跟着写入变化 */
export class FakeStorage implements StorageCapability {
  usage = 0
  quota = 10 * 1024 ** 3
  /**
   * persist() 会不会被同意。默认同意：标准环境是装成 WebAPK 的 Android Chrome，
   * Chrome 对装好的应用自动同意持久存储（Spec #11 App 外壳）
   */
  persistGranted = true
  #persisted = false

  async estimate(): Promise<StorageEstimate> {
    return { usage: this.usage, quota: this.quota }
  }

  async persist(): Promise<boolean> {
    if (this.persistGranted)
      this.#persisted = true
    return this.#persisted
  }

  async persisted(): Promise<boolean> {
    return this.#persisted
  }
}

/** 歌曲信息，同 new MediaMetadata(init) */
export class FakeMediaMetadata implements MediaMetadata {
  title: string
  artist: string
  album: string
  artwork: readonly MediaImage[]

  constructor(init: MediaMetadataInit = {}) {
    this.title = init.title ?? ''
    this.artist = init.artist ?? ''
    this.album = init.album ?? ''
    this.artwork = (init.artwork ?? []).map(image => ({ ...image }))
  }
}

/** 一个标签页的 Media Session：测试看锁屏上显示什么、有哪些按钮，也能模拟按按钮 */
export class FakeMediaSession implements MediaSessionCapability {
  metadata: MediaMetadata | null = null
  playbackState: MediaSessionPlaybackState = 'none'
  /** 最近一次 setPositionState 设的进度；没设过或已清除时是 null */
  position: Required<MediaPositionState> | null = null
  readonly #handlers = new Map<MediaSessionAction, MediaSessionActionHandler>()

  /** 锁屏和通知栏上有哪些按钮 */
  get actions(): MediaSessionAction[] {
    return [...this.#handlers.keys()]
  }

  setActionHandler(action: MediaSessionAction, handler: MediaSessionActionHandler | null): void {
    if (handler)
      this.#handlers.set(action, handler)
    else
      this.#handlers.delete(action)
  }

  // 和浏览器一样按 Media Session 标准校验：不传或传空对象是清除；
  // 时长必填且不为负，进度在 0 到时长之间，速度不为 0，不符合就抛 TypeError
  setPositionState(state?: MediaPositionState): void {
    if (!state || Object.keys(state).length === 0) {
      this.position = null
      return
    }
    const { duration, position = 0, playbackRate = 1 } = state
    if (duration === undefined || Number.isNaN(duration) || duration < 0)
      throw new TypeError(`setPositionState：时长不合法（${duration}）`)
    if (position < 0 || position > duration)
      throw new TypeError(`setPositionState：进度 ${position} 不在 0 到 ${duration} 之间`)
    if (playbackRate === 0)
      throw new TypeError('setPositionState：速度不能是 0')
    this.position = { duration, position, playbackRate }
  }

  /** 模拟听众按了锁屏或通知栏上的按钮 */
  press(action: MediaSessionAction, details: Omit<MediaSessionActionDetails, 'action'> = {}): void {
    const handler = this.#handlers.get(action)
    if (!handler)
      throw new Error(`锁屏上没有 ${action} 按钮`)
    handler({ action, ...details })
  }
}

import type { Clock as FakeTimers } from '@sinonjs/fake-timers'
import type { AudioCapability, ChannelCapability, Clock, LocksCapability, MediaSessionCapability, NetworkStatus, PageVisibility, StorageCapability } from '#lib/app/browser.js'

// 浏览器能力替身：行为照浏览器标准写。
// 浏览器直连网易云的传输、Background Fetch 由最早用到它们的票加上。

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

/**
 * 网易云的反作弊令牌（官方 Watchman）：一个标签页一个。每次取一枚新的、170 个字符（和真的一样长）；
 * available 设成 false 时取不到（Watchman 没加载出来，例如被浏览器插件拦了）
 */
export class FakeWatchman {
  available = true
  /** 发出去的令牌，按先后 */
  readonly issued: string[] = []

  async checkToken(): Promise<string> {
    if (!this.available)
      throw new Error('Watchman 的脚本没加载出来')
    const token = `${this.issued.length + 1}`.padStart(170, 'W')
    this.issued.push(token)
    return token
  }
}

/** 锁，同 Lock：名字和模式 */
class FakeLock implements Lock {
  constructor(readonly name: string, readonly mode: LockMode) {}
}

interface LockRequest {
  name: string
  mode: LockMode
  callback: LockGrantedCallback<unknown>
  signal: AbortSignal | undefined
  /** 已经调了回调：之后 signal 不再理会（§4.4 第 14.1.2 步） */
  invoked: boolean
  /** request() 返回的 promise（标准里的 released promise） */
  settle: { resolve: (value: unknown) => void, reject: (reason: unknown) => void }
}

/** 调回调；回调同步抛错时当作返回了失败的 promise（WebIDL 对返回 Promise 的回调的规定） */
function invoke(callback: LockGrantedCallback<unknown>, lock: Lock | null): Promise<unknown> {
  return new Promise(resolve => resolve(callback(lock)))
}

/**
 * 跨标签页的锁（Web Locks），一台设备一个，所有标签页共用。照 W3C Web Locks API（2025-09-24 编辑草案）§4 的算法写：
 * - 同名的请求按先后排队，只有排在最前、又不和已持有的锁冲突的才能拿到（grantable）；
 *   exclusive 和同名的任何锁冲突，shared 只和同名的 exclusive 冲突。
 * - 拿到锁后排一个任务（宏任务，§4.4 第 14 步“enqueue … on the responsible event loop”）调回调；
 *   回调返回的 promise 了结（成功或失败）才释放锁，request() 跟着它了结。
 * - ifAvailable：拿不到就不排队，回调收到 null，request() 不失败。
 * - signal：调回调之前被取消，request() 以取消的原因失败；还在排队就从队列里拿掉，已经拿到锁就释放、不调回调。
 * - steal：App 没用到，替身没做，用到时照 §4.1 第 4 步补上。
 */
export class FakeLocks implements LocksCapability {
  readonly #held: FakeLock[] = []
  readonly #queues = new Map<string, LockRequest[]>()
  /** 已经排下、还没跑的回调任务有几个 */
  pending = 0

  /** 在页面的事件循环里排一个任务 */
  #task(step: () => void): void {
    this.pending += 1
    setImmediate(() => {
      this.pending -= 1
      step()
    })
  }

  request<T>(name: string, callback: LockGrantedCallback<T>): Promise<Awaited<T>>
  request<T>(name: string, options: LockOptions, callback: LockGrantedCallback<T>): Promise<Awaited<T>>
  request<T>(name: string, ...args: [LockGrantedCallback<T>] | [LockOptions, LockGrantedCallback<T>]): Promise<Awaited<T>> {
    const [options, callback] = args.length === 1 ? [{}, args[0]] : args
    const { mode = 'exclusive', ifAvailable = false, steal = false, signal } = options
    // §3.2.1 request() 第 5～9 步
    const notSupported = (message: string) => Promise.reject(new DOMException(message, 'NotSupportedError'))
    if (name.startsWith('-'))
      return notSupported('以 - 开头的锁名是保留的')
    if (steal && ifAvailable)
      return notSupported('steal 和 ifAvailable 不能同时用')
    if (steal && mode !== 'exclusive')
      return notSupported('steal 只能用于 exclusive')
    if (signal && (steal || ifAvailable))
      return notSupported('signal 不能和 steal、ifAvailable 同时用')
    if (signal?.aborted)
      return Promise.reject(signal.reason)
    if (steal)
      throw new Error('Web Locks 替身没有做 steal')

    return new Promise((resolve, reject) => {
      const request: LockRequest = { name, mode, callback: callback as LockGrantedCallback<unknown>, signal, invoked: false, settle: { resolve: resolve as (value: unknown) => void, reject } }
      const queue = this.#queue(name)
      // §4.1 第 3.5 步
      if (ifAvailable && !this.#grantable(request)) {
        this.#task(() => resolve(invoke(request.callback, null) as Promise<Awaited<T>>))
        return
      }
      // §4.3 signal to abort the request
      signal?.addEventListener('abort', () => {
        if (request.invoked)
          return
        reject(signal.reason)
        const at = queue.indexOf(request)
        if (at !== -1) {
          queue.splice(at, 1)
          this.#process(name)
        }
      }, { once: true })
      queue.push(request)
      this.#process(name)
    })
  }

  #queue(name: string): LockRequest[] {
    let queue = this.#queues.get(name)
    if (!queue)
      this.#queues.set(name, queue = [])
    return queue
  }

  /** §2.5 grantable */
  #grantable(request: LockRequest): boolean {
    const queue = this.#queue(request.name)
    if (queue.length > 0 && queue[0] !== request)
      return false
    const sameName = this.#held.filter(lock => lock.name === request.name)
    return request.mode === 'exclusive' ? sameName.length === 0 : sameName.every(lock => lock.mode !== 'exclusive')
  }

  /** §4.4 process the lock request queue */
  #process(name: string): void {
    const queue = this.#queue(name)
    while (queue.length > 0 && this.#grantable(queue[0])) {
      const request = queue.shift()!
      const lock = new FakeLock(request.name, request.mode)
      this.#held.push(lock)
      const release = () => {
        this.#held.splice(this.#held.indexOf(lock), 1)
        this.#process(name)
      }
      this.#task(() => {
        if (request.signal?.aborted)
          return release()
        request.invoked = true
        const waiting = invoke(request.callback, lock)
        // §2.4：waiting promise 了结（成功或失败）后释放锁，released promise 跟着它了结
        void waiting.catch(() => {}).then(() => {
          release()
          request.settle.resolve(waiting)
        })
      })
    }
  }
}

/**
 * 跨标签页的广播（BroadcastChannel），一台设备一份，所有标签页共用。照 HTML 标准 §9.5 postMessage() 的步骤：
 * - 关闭后再发抛 InvalidStateError；消息先结构化克隆（克隆不了照样抛出）；
 * - 送给同名、还没关闭的其他频道，不送给自己；按频道创建的先后，每个频道排一个任务（宏任务）送达，
 *   送达时已经关闭的就不送；收到时发 message 事件，消息在 data 里。
 */
export class FakeBroadcast {
  readonly #open = new Set<FakeChannel>()
  /** 已经发出、还没送达的消息有几份 */
  pending = 0

  channel = (name: string): ChannelCapability => {
    const channel = new FakeChannel(name, this)
    this.#open.add(channel)
    return channel
  }

  /** 频道发消息：克隆好的消息送给同名的其他频道 */
  deliver(source: FakeChannel, data: unknown): void {
    for (const destination of this.#open) {
      if (destination === source || destination.name !== source.name)
        continue
      this.pending += 1
      setImmediate(() => {
        this.pending -= 1
        if (!destination.closed)
          destination.dispatchEvent(new MessageEvent('message', { data: structuredClone(data) }))
      })
    }
  }

  forget(channel: FakeChannel): void {
    this.#open.delete(channel)
  }
}

class FakeChannel extends EventTarget implements ChannelCapability {
  closed = false

  constructor(readonly name: string, private readonly broadcast: FakeBroadcast) {
    super()
  }

  postMessage(message: unknown): void {
    if (this.closed)
      throw new DOMException('频道已经关闭', 'InvalidStateError')
    this.broadcast.deliver(this, structuredClone(message))
  }

  close(): void {
    this.closed = true
    this.broadcast.forget(this)
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

/** 播放器排的事件任务：一台设备一份，排着的没跑完算设备还在忙 */
export class MediaTasks {
  pending = 0

  queue(step: () => void): void {
    this.pending += 1
    setImmediate(() => {
      this.pending -= 1
      step()
    })
  }
}

/** MediaError 的 code */
export const MEDIA_ERR_NETWORK = 2
export const MEDIA_ERR_SRC_NOT_SUPPORTED = 4

interface PendingPlay {
  resolve: () => void
  reject: (reason: DOMException) => void
}

/**
 * 播放器（<audio>），照 HTML 标准“媒体元素”里 App 用到的部分：
 * - 设 src 就是重新加载（media element load algorithm）：停下、进度回到 0、时长变回 NaN、清掉出错，还没了结的 play() 以 AbortError 失败；
 *   加载出来之前设的 currentTime 记着，加载出来后从那里开始放（default playback start position）。
 * - play()：放完了的从头放；暂停着就改成没暂停、排任务发 play，数据还不够就再发 waiting，够了就发 playing、play() 成功。
 * - pause()：没暂停就改成暂停，排任务发 timeupdate、pause，还没了结的 play() 以 AbortError 失败。
 * 音频服务器那边由测试决定：数据什么时候够放（ready）、放到哪了（progress）、放完（end）、断流（stall）、出错（fail）。
 * 这些由测试直接调，事件当场发：测试本身就是事件循环里的一个任务
 */
export class FakeAudio extends EventTarget implements AudioCapability {
  #src = ''
  #currentTime = 0
  duration = Number.NaN
  paused = true
  ended = false
  volume = 1
  preload: AudioCapability['preload'] = 'auto'
  error: { code: number } | null = null
  /** 正在出声：没暂停、数据够放、发过 playing */
  sounding = false
  /** 音频服务器给的数据够放了 */
  #ready = false
  #pending: PendingPlay[] = []
  /** 所在的标签页关掉了 */
  #closed = false

  constructor(private readonly tasks: MediaTasks) {
    super()
  }

  /**
   * 标签页关掉了：文档没了，播放器跟着停下，不再出声、不再发事件，还没了结的 play() 也不会再了结。
   * 依据 HTML 标准：媒体元素所在的文档不再 fully active 时停止播放（Playing the media resource）；
   * 销毁文档时，它排着的任务直接丢掉、不再运行（destroy a document）
   */
  close(): void {
    this.#closed = true
    this.paused = true
    this.sounding = false
    this.#pending = []
  }

  get src(): string {
    return this.#src
  }

  set src(value: string) {
    this.#src = value
    this.#ready = false
    this.paused = true
    this.sounding = false
    this.ended = false
    this.#currentTime = 0
    this.duration = Number.NaN
    this.error = null
    this.#reject(this.#take(), 'AbortError')
  }

  get currentTime(): number {
    return this.#currentTime
  }

  set currentTime(value: number) {
    this.#currentTime = value
    this.ended = false
  }

  play(): Promise<void> {
    if (this.error?.code === MEDIA_ERR_SRC_NOT_SUPPORTED)
      return Promise.reject(new DOMException('地址放不了', 'NotSupportedError'))
    const promise = new Promise<void>((resolve, reject) => this.#pending.push({ resolve, reject }))
    if (this.ended)
      this.currentTime = 0
    if (this.paused) {
      this.paused = false
      this.tasks.queue(() => this.#fire('play'))
      if (!this.#ready)
        this.tasks.queue(() => this.#fire('waiting'))
    }
    if (this.#ready) {
      this.tasks.queue(() => {
        if (this.paused || !this.#ready)
          return
        this.#sound()
      })
    }
    return promise
  }

  pause(): void {
    if (this.paused)
      return
    this.paused = true
    this.sounding = false
    const pending = this.#take()
    this.tasks.queue(() => {
      this.#fire('timeupdate')
      this.#fire('pause')
      this.#reject(pending, 'AbortError')
    })
  }

  /** 音频服务器的数据到了、够放了，知道了时长（秒）；没暂停的话就出声 */
  ready(duration = 240): void {
    if (!this.#src)
      throw new Error('播放器还没有地址')
    const known = !Number.isNaN(this.duration)
    this.#ready = true
    this.duration = duration
    if (!known)
      this.#fire('durationchange')
    this.#fire('canplaythrough')
    if (!this.paused)
      this.#sound()
  }

  /** 放到了第几秒 */
  progress(seconds: number): void {
    if (!this.sounding)
      throw new Error('播放器没在出声')
    this.#currentTime = seconds
    this.#fire('timeupdate')
  }

  /** 放完了 */
  end(): void {
    if (!this.sounding)
      throw new Error('播放器没在出声')
    this.#currentTime = this.duration
    this.paused = true
    this.sounding = false
    this.ended = true
    this.#fire('timeupdate')
    this.#fire('pause')
    this.#fire('ended')
  }

  /** 数据接不上了，停下等着（断网、网络慢） */
  stall(): void {
    if (!this.sounding)
      throw new Error('播放器没在出声')
    this.#ready = false
    this.sounding = false
    this.#fire('waiting')
  }

  /** 加载出错：MEDIA_ERR_NETWORK 是网络出错（放到一半断流、地址过期），MEDIA_ERR_SRC_NOT_SUPPORTED 是地址放不了 */
  fail(code: typeof MEDIA_ERR_NETWORK | typeof MEDIA_ERR_SRC_NOT_SUPPORTED = MEDIA_ERR_NETWORK): void {
    this.error = { code }
    this.#ready = false
    this.sounding = false
    this.#fire('error')
    if (code === MEDIA_ERR_SRC_NOT_SUPPORTED)
      this.#reject(this.#take(), 'NotSupportedError')
  }

  #sound(): void {
    if (!this.sounding) {
      this.sounding = true
      this.#fire('playing')
    }
    for (const pending of this.#take())
      pending.resolve()
  }

  #take(): PendingPlay[] {
    const pending = this.#pending
    this.#pending = []
    return pending
  }

  #reject(pending: PendingPlay[], name: 'AbortError' | 'NotSupportedError'): void {
    for (const play of pending)
      play.reject(new DOMException(name === 'AbortError' ? '播放被打断' : '地址放不了', name))
  }

  #fire(type: string): void {
    if (!this.#closed)
      this.dispatchEvent(new Event(type))
  }
}

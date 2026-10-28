import type { Clock as FakeTimers } from '@sinonjs/fake-timers'

import type { CoverCrop } from '#lib/api/cover.js'
import { COVER_WORK_MAX_SIDE } from '#lib/api/cover.js'
import type { AudioCapability, ChannelCapability, Clock, DecodedImage, DownloadOptions, FileCapability, FolderCapability, LocksCapability, MediaSessionCapability, NetworkStatus, PageVisibility, StorageEstimate, WritableCapability } from '#lib/app/browser.js'

// 浏览器能力替身：行为照浏览器标准写。浏览器直连网易云的图片传输（#34）、文件下载（#38）、导出时听众选的文件夹（#79）在这里；Background Fetch 由最早用到它的票加上。

/** App 的时钟：和世界的假时钟走同一个时间，定时按到期先后触发 */
export const clockOn = (timers: FakeTimers): Clock => ({
  now: () => timers.now,
  after(ms, callback) {
    const id = timers.setTimeout(callback, ms)
    return () => timers.clearTimeout(id)
  },
})

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

/** 这台设备给这个站点多少存储空间：usage、quota 由测试改；默认空间很够 */
export class FakeStorage {
  usage = 0
  quota = Number.MAX_SAFE_INTEGER
  /** 申请持久存储了几次（#40）：App 只该申请一次 */
  persistCalls = 0
  /** 浏览器答不答应；默认答应 */
  persistResult = true

  async estimate(): Promise<StorageEstimate> {
    return {
      usage: this.usage,
      quota: this.quota,
    }
  }

  async persist(): Promise<boolean> {
    this.persistCalls += 1
    return this.persistResult
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

/** 网易云的反作弊令牌（官方 Watchman）：一个标签页一个，每次取一枚新的、170 个字符（和真的一样长）；available 设成 false 时取不到（脚本没加载出来，例如被浏览器插件拦了） */
export class FakeWatchman {
  available = true
  readonly issued: string[] = []

  async checkToken(): Promise<string> {
    if (!this.available)
      throw new Error('Watchman 的脚本没加载出来')
    const token = `${this.issued.length + 1}`.padStart(170, 'W')
    this.issued.push(token)
    return token
  }
}

/** 测试里造的一张图片：只有 App 读的 name、type、size，解码由 FakeImages 按这里写的尺寸给 */
export interface FakeImageFile {
  name?: string
  type?: string
  bytes?: number
  width?: number
  height?: number
  /** false：浏览器解不开（HEIC、损坏的文件） */
  decodable?: boolean
}

export interface FakeCoverUpload {
  url: string
  jpeg: Blob
  token: string
  signal: AbortSignal
  aborted: boolean
}

interface WaitingUpload {
  resolve: () => void
  reject: (error: Error) => void
}

/** 换封面的浏览器能力替身（#34）：造测试图片、解码（按写的尺寸，长边缩到 3200）、导出 JPEG、直传网易云图片存储。直传可压着不回（取消用）、设成失败、看传了什么；导出大小可设。 */
export class FakeImages {
  /** 直传失败：设成错误后，下一次直传以它失败 */
  uploadError: Error | null = null
  /** 直传压着不回：releaseUpload() 才完成 */
  holdUploads = false
  /** 导出的 JPEG 有多少字节（默认 300 KB） */
  exportBytes = 300_000
  exportError: Error | null = null
  readonly uploads: FakeCoverUpload[] = []
  readonly exports: { image: DecodedImage, crop: CoverCrop }[] = []
  readonly released: string[] = []
  #files = new WeakMap<File, FakeImageFile>()
  #images = new Map<DecodedImage, { released: boolean }>()
  #waiting: WaitingUpload[] = []
  #count = 0

  /** 一张测试图片：App 只看 name、type、size，不解码真数据 */
  file(spec: FakeImageFile = {}): File {
    const { name = 'photo.jpg', type = 'image/jpeg', bytes = 1_000_000 } = spec
    const file = { name, type, size: bytes } as File
    this.#files.set(file, spec)
    return file
  }

  async decode(file: File): Promise<DecodedImage> {
    const spec = this.#files.get(file)
    if (!spec || spec.decodable === false)
      throw new DOMException('不能解码', 'InvalidStateError')
    const origWidth = spec.width ?? 800
    const origHeight = spec.height ?? 800
    const scale = Math.min(1, COVER_WORK_MAX_SIDE / Math.max(origWidth, origHeight))
    const image: DecodedImage = {
      url: `blob:fake-cover-${++this.#count}`,
      width: Math.round(origWidth * scale),
      height: Math.round(origHeight * scale),
      origWidth,
      origHeight,
    }
    this.#images.set(image, { released: false })
    return image
  }

  release(image: DecodedImage): void {
    const entry = this.#images.get(image)
    if (!entry || entry.released)
      return
    entry.released = true
    this.released.push(image.url)
  }

  async exportJpeg(image: DecodedImage, crop: CoverCrop): Promise<Blob> {
    if (this.exportError)
      throw this.exportError
    this.exports.push({ image, crop })
    return new Blob([
      new Uint8Array(this.exportBytes),
    ], { type: 'image/jpeg' })
  }

  uploadCoverImage(url: string, jpeg: Blob, token: string, signal: AbortSignal): Promise<void> {
    const upload: FakeCoverUpload = {
      url,
      jpeg,
      token,
      signal,
      aborted: false,
    }
    this.uploads.push(upload)
    if (this.uploadError)
      return Promise.reject(this.uploadError)
    return new Promise<void>((resolve, reject) => {
      const abort = () => {
        upload.aborted = true
        reject(new DOMException('直传被取消', 'AbortError'))
      }
      if (signal.aborted)
        return abort()
      signal.addEventListener('abort', abort, { once: true })
      if (!this.holdUploads)
        resolve()
      else
        this.#waiting.push({ resolve, reject })
    })
  }

  releaseUpload(): void {
    this.#waiting.shift()?.resolve()
  }

  failUpload(error: Error): void {
    this.#waiting.shift()?.reject(error)
  }
}

/** 网易云服务器上的一个文件：多少字节、什么类型；ranges=false 模拟不支持分段请求的服务器 */
export interface FakeFile {
  bytes: number
  type: string
  ranges?: boolean
}

/** 下一次下载这个文件时怎么传：until 了结之前只传（剩下的一半）；cut：传到一半连接断开 */
export interface FakeTransfer {
  until?: Promise<void>
  cut?: boolean
}

/** 压着的传输被取消（AbortSignal）：以 AbortError 拒绝；没有 signal 时永远不了结，只有 until 决定 */
const aborted = (signal?: AbortSignal): Promise<never> => {
  const { promise, reject } = Promise.withResolvers<never>()
  signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  return promise
}

/** 网易云的音频服务器、图片服务器（浏览器直连下载，#38）：一台设备一份，测试放上文件（地址 → 字节数、类型）。 照 Fetch 标准：断网时请求直接以 TypeError 失败（network error）；没有这个文件回 404，fetch 本身成功、由 App 的下载能力当作失败； 回 200 / 206 按块传，传到一半连接断开（断网、服务器断开）时读响应体以 TypeError 失败。每块数据调一次 onChunk；从 from 字节开始（断点续传，#39），不支持分段时调 restart 再从头交 */
export class FakeFiles {
  readonly #files = new Map<string, FakeFile>()
  readonly #next = new Map<string, FakeTransfer>()
  /** 下载过的地址，按先后（断网时没发出去的不算） */
  readonly requests: string[] = []
  /** 每次下载从第几字节开始，和 requests 一一对应 */
  readonly starts: number[] = []

  constructor(private readonly network: NetworkStatus) {}

  put(url: string, file: FakeFile): void {
    this.#files.set(url, file)
  }

  /** 下一次下载这个地址时：压着只传一半（until），或者传到一半断开（cut） */
  next(url: string, transfer: FakeTransfer): void {
    this.#next.set(url, transfer)
  }

  /** 照 fetch 的取消语义：开始前已经 abort 直接以 AbortError 失败；压着的传输中途 abort 立即拒绝，不等 release */
  async download(url: string, onChunk: (chunk: Uint8Array<ArrayBuffer>) => void, { from = 0, restart, signal }: DownloadOptions = {}): Promise<{ type: string }> {
    if (signal?.aborted)
      throw new DOMException('Aborted', 'AbortError')
    if (!this.network.onLine)
      throw new TypeError('Failed to fetch')
    this.requests.push(url)
    this.starts.push(from)
    const file = this.#files.get(url)
    if (!file)
      throw new Error('文件服务器回了 404')
    if (from > 0 && file.ranges === false) {
      restart?.()
      from = 0
    }
    const transfer = this.#next.get(url) ?? {}
    this.#next.delete(url)
    const half = from + Math.floor((file.bytes - from) / 2)
    if (transfer.until || transfer.cut) {
      onChunk(new Uint8Array(half - from))
      if (transfer.until) {
        await Promise.race([
          transfer.until,
          aborted(signal),
        ])
      }
      if (signal?.aborted)
        throw new DOMException('Aborted', 'AbortError')
      if (transfer.cut || !this.network.onLine)
        throw new TypeError('network error')
      onChunk(new Uint8Array(file.bytes - half))
    }
    else {
      onChunk(new Uint8Array(file.bytes - from))
    }
    return { type: file.type }
  }
}

/** 本机文件的地址（URL.createObjectURL），一台设备一份，测试按地址找回是哪个文件。照 File API 标准（§8.3 Blob URLs）：revokeObjectURL 以后这个地址就失效，再按它找不到文件（浏览器里拿它加载会失败） */
export class FakeObjectUrls {
  readonly #blobs = new Map<string, Blob>()
  #count = 0

  create(blob: Blob): string {
    const url = `blob:campanula/${++this.#count}`
    this.#blobs.set(url, blob)
    return url
  }

  revoke(url: string): void {
    this.#blobs.delete(url)
  }

  /** 这个地址是哪个文件；不是 createObjectURL 给的、已经 revoke 了的是 undefined */
  blobOf(url: string): Blob | undefined {
    return this.#blobs.get(url)
  }
}

/** 下一次往文件里写时怎么样：until 了结之前写不完；error：写的时候失败（空间不够是 QuotaExceededError） */
export interface FakeWrite {
  until?: Promise<void>
  error?: DOMException
}

/**
 * 听众在选择器里选的一个文件夹（#79），测试建好交给 device.folders.next。照 File System 标准的 FileSystemDirectoryHandle：
 * getFileHandle 带 create 时没有就马上建一个空文件，不带时没有就以 NotFoundError 失败，名字不合法（空、“.”“..”、带 / 或 \）以 TypeError 失败。
 * 照 File System Access 标准的 FileSystemWritableFileStream 和 Streams 标准：写进一份临时副本，close 时才换掉文件内容；abort 丢掉临时副本，
 * 正在写的那一次（已经交给文件系统）照样写完、abort 等它写完才了结，之后 close 失败；已经出错、关上的流 abort 什么都不做
 */
export class FakeFolder implements FolderCapability {
  /** 文件夹里的文件：名字 → 内容（临时副本不算） */
  readonly files = new Map<string, Blob>()
  readonly #next = new Map<string, FakeWrite>()
  readonly #started = new Map<string, () => void>()

  /** existing：文件夹里本来就有的文件 */
  constructor(readonly name: string, existing: readonly string[] = []) {
    for (const file of existing)
      this.files.set(file, new Blob())
  }

  /** 下一次往这个文件里写时怎么样 */
  nextWrite(file: string, write: FakeWrite): void {
    this.#next.set(file, write)
  }

  /** 开始往这个文件里写时了结 */
  writing(file: string): Promise<void> {
    return new Promise(resolve => this.#started.set(file, resolve))
  }

  async getFileHandle(name: string, { create = false } = {}): Promise<FileCapability> {
    if (!name || name === '.' || name === '..' || /[/\\]/.test(name))
      throw new TypeError(`Name is not allowed: ${name}`)
    if (!this.files.has(name)) {
      if (!create)
        throw new DOMException(`A requested file or directory could not be found: ${name}`, 'NotFoundError')
      this.files.set(name, new Blob())
    }
    return {
      createWritable: async () => this.#writable(name),
    }
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.files.delete(name))
      throw new DOMException(`A requested file or directory could not be found: ${name}`, 'NotFoundError')
  }

  #writable(name: string): WritableCapability {
    const chunks: Blob[] = []
    let state: 'writable' | 'erroring' | 'errored' | 'closed' = 'writable'
    let inFlight: Promise<unknown> | null = null
    return {
      write: async (data) => {
        if (state !== 'writable')
          throw new TypeError('The stream is not writable')
        const planned = this.#next.get(name) ?? {}
        this.#next.delete(name)
        this.#started.get(name)?.()
        this.#started.delete(name)
        const writing = (async () => {
          await planned.until
          if (planned.error) {
            state = 'errored'
            throw planned.error
          }
          chunks.push(data)
        })()
        inFlight = writing
        try {
          await writing
        }
        finally {
          inFlight = null
        }
      },
      close: async () => {
        if (state !== 'writable')
          throw new TypeError('The stream is not writable')
        state = 'closed'
        this.files.set(name, new Blob(chunks))
      },
      abort: async () => {
        if (state === 'errored' || state === 'closed')
          return
        state = 'erroring'
        await inFlight?.catch(() => {})
        state = 'errored'
        chunks.length = 0
      },
    }
  }
}

/** 下一次打开文件夹选择器时听众怎么做：选这个文件夹，或者取消 */
export type FolderChoice = FakeFolder | 'cancel'

/** 文件夹选择器（showDirectoryPicker，#79），一台设备一份。照 File System Access 标准：听众取消时以 AbortError 失败。supported 为 false：这个浏览器不支持选文件夹 */
export class FakeFolders {
  supported = true
  /** 打开过几次选择器 */
  opened = 0
  readonly #choices: FolderChoice[] = []

  next(choice: FolderChoice): void {
    this.#choices.push(choice)
  }

  async pick(): Promise<FakeFolder> {
    this.opened += 1
    const choice = this.#choices.shift()
    if (choice === undefined)
      throw new Error('测试没有排好听众在文件夹选择器里怎么做')
    if (choice === 'cancel')
      throw new DOMException('The user aborted a request.', 'AbortError')
    return choice
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
const invoke = (callback: LockGrantedCallback<unknown>, lock: Lock | null): Promise<unknown> => new Promise(resolve => resolve(callback(lock)))

/**
 * 跨标签页的锁（Web Locks），一台设备一个，所有标签页共用。照 W3C Web Locks API（2025-09-24 编辑草案）§4 的算法写：
 * - 同名的请求按先后排队，只有排在最前、又不和已持有的锁冲突的才能拿到（grantable）；exclusive 和同名的任何锁冲突，shared 只和同名的 exclusive 冲突。
 * - 拿到锁后排一个任务（宏任务，§4.4 第 14 步“enqueue … on the responsible event loop”）调回调；回调返回的 promise 了结（成功或失败）才释放锁，request() 跟着它了结。
 * - ifAvailable：拿不到就不排队，回调收到 null，request() 不失败。signal：调回调之前被取消，request() 以取消的原因失败；还在排队就从队列里拿掉，已经拿到锁就释放、不调回调。
 * - steal：App 没用到，替身没做，用到时照 §4.1 第 4 步补上。
 */
export class FakeLocks implements LocksCapability {
  readonly #held: FakeLock[] = []
  readonly #queues = new Map<string, LockRequest[]>()
  /** 已经排下、还没跑的回调任务有几个 */
  pending = 0

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
    const [options, callback] = args.length === 1
      ? [{}, args[0]]
      : args
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
      const request: LockRequest = {
        name,
        mode,
        callback: callback as LockGrantedCallback<unknown>,
        signal,
        invoked: false,
        settle: { resolve: resolve as (value: unknown) => void, reject },
      }
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
    return request.mode === 'exclusive'
      ? sameName.length === 0
      : sameName.every(lock => lock.mode !== 'exclusive')
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

/** 跨标签页的广播（BroadcastChannel），一台设备一份，所有标签页共用。照 HTML 标准 §9.5 postMessage() 的步骤：关闭后再发抛 InvalidStateError； 消息先结构化克隆（克隆不了照样抛出）；送给同名、还没关闭的其他频道，不送给自己；按频道创建的先后，每个频道排一个任务（宏任务）送达， 送达时已经关闭的就不送；收到时发 message 事件，消息在 data 里。 */
export class FakeBroadcast {
  readonly #open = new Set<FakeChannel>()
  /** 已经发出、还没送达的消息有几份 */
  pending = 0

  channel = (name: string): ChannelCapability => {
    const channel = new FakeChannel(name, this)
    this.#open.add(channel)
    return channel
  }

  deliver(source: FakeChannel, data: unknown): void {
    for (const destination of this.#open) {
      if (destination === source || destination.name !== source.name)
        continue
      this.pending += 1
      setImmediate(() => {
        this.pending -= 1
        if (!destination.closed) {
          destination.dispatchEvent(new MessageEvent('message', {
            data: structuredClone(data),
          }))
        }
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
    return [
      ...this.#handlers.keys(),
    ]
  }

  setActionHandler(action: MediaSessionAction, handler: MediaSessionActionHandler | null): void {
    if (handler)
      this.#handlers.set(action, handler)
    else
      this.#handlers.delete(action)
  }

  // 和浏览器一样按 Media Session 标准校验：不传或传空对象是清除；时长必填且不为负，进度在 0 到时长之间，速度不为 0，不符合就抛 TypeError
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
 * 播放器（<audio>），照 HTML 标准“媒体元素”里 App 用到的部分：设 src 即重新加载（media element load algorithm，停下、进度归 0、时长变 NaN、清了出错，
 * 未了结的 play() 以 AbortError 失败；加载前设的 currentTime 记着，加载后从那里开始放，即 default playback start position）。
 * play()：放完的从头放；暂停就改成没暂停、排任务发 play，数据不够再发 waiting，够了发 playing、play() 成功。pause()：排任务发 timeupdate、pause，未了结的 play() 以 AbortError 失败；音频服务器那边由测试决定（ready / progress / end / stall / fail），测试直接调、事件当场发。
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
  #ready = false
  #pending: PendingPlay[] = []
  #closed = false

  constructor(private readonly tasks: MediaTasks) {
    super()
  }

  /** 标签页关掉了：文档没了，播放器跟着停下、不再出声、不再发事件，未了结的 play() 也不再了结。依据 HTML 标准：文档不再 fully active 时停止播放（Playing the media resource），销毁文档时排着的任务直接丢掉（destroy a document） */
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

  progress(seconds: number): void {
    if (!this.sounding)
      throw new Error('播放器没在出声')
    this.#currentTime = seconds
    this.#fire('timeupdate')
  }

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
    for (const play of pending) {
      play.reject(new DOMException(name === 'AbortError'
        ? '播放被打断'
        : '地址放不了', name))
    }
  }

  #fire(type: string): void {
    if (!this.#closed)
      this.dispatchEvent(new Event(type))
  }
}

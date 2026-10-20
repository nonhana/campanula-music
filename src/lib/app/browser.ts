import type { CoverCrop } from '#lib/api/cover.js'
import { COVER_OUTPUT_MAX_BYTES, COVER_OUTPUT_MIN_QUALITY, COVER_OUTPUT_QUALITY, COVER_OUTPUT_SIZE, COVER_WORK_MAX_SIDE } from '#lib/api/cover.js'
import { mock } from '#lib/mock-flag.js'

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
  /** 换封面用的图片处理（#34）：读图、预览、裁成正方形导出 JPEG。App 不直接用 canvas、createImageBitmap */
  images: ImageCapability
  /**
   * 浏览器直连网易云的图片存储（#34）：把导出的 JPEG 传到 uploadUrl（跨域 POST），带上传凭证，可以中途取消。
   * 只用于换封面的第二步；#38 的音频下载是另一类传输，到时候再加
   */
  uploadCoverImage: (url: string, jpeg: Blob, token: string, signal: AbortSignal) => Promise<void>
}

/** 一张已经解码、按 EXIF 摆正的图片（换封面用） */
export interface DecodedImage {
  /** 预览图的地址（blob: URL），关掉裁剪页时释放 */
  readonly url: string
  /** 工作位图的宽高：长边已经缩到 COVER_WORK_MAX_SIDE 以内，裁剪坐标按它算 */
  readonly width: number
  readonly height: number
  /** 原图的宽高（缩小之前） */
  readonly origWidth: number
  readonly origHeight: number
}

export interface ImageCapability {
  /**
   * 读选好的文件：按 EXIF 摆正，长边超过 COVER_WORK_MAX_SIDE 的先缩小，另做一张长边最多 1600px 的预览图。
   * 解不开时抛错（是不是 HEIC、是不是图片由 App 按文件类型和扩展名判断，能不能用以这里成功为准）
   */
  decode: (file: File) => Promise<DecodedImage>
  /** 释放预览地址和位图 */
  release: (image: DecodedImage) => void
  /** 从工作位图里裁出正方形，导出 COVER_OUTPUT_SIZE 的正方形 JPEG；超过 1 MB 就降质量重压（最低 0.6） */
  exportJpeg: (image: DecodedImage, crop: CoverCrop) => Promise<Blob>
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
  // mock 开发环境不向网易云加载 Watchman 脚本（#58：mock 不发外网请求）；服务端也接受这个固定令牌
  if (mock)
    return 'mock-watchman-token'
  const instance = await loadWatchman()
  const token = await withTimeout(new Promise<string>(resolve => instance.getToken(WATCHMAN.business, resolve)), '取反作弊令牌')
  if (!token)
    throw new Error('Watchman 给了一个空的令牌')
  return token
}

/** 预览图的边长上限（px）：超大照片直接塞进 <img> 会让手机卡一下 */
const COVER_PREVIEW_MAX = 1600
/** 预览图、导出用的 canvas 都是 JPEG，透明的地方铺白（JPEG 没有透明） */
const WHITE = '#fff'

interface Decoded {
  bitmap: ImageBitmap
  url: string
}

/** 解码出来的位图和预览地址：DecodedImage 只有界面要用的尺寸和地址，位图留在这里给裁切用 */
const decoded = new WeakMap<DecodedImage, Decoded>()

function drawWhite(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d')
  if (!context)
    throw new Error('浏览器不给 canvas 的绘图上下文')
  context.fillStyle = WHITE
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.imageSmoothingQuality = 'high'
  return context
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('浏览器没能导出 JPEG')), 'image/jpeg', quality))
}

async function decodeImage(file: File): Promise<DecodedImage> {
  // imageOrientation: 'from-image' 让手机竖拍的照片按 EXIF 摆正
  let bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const origWidth = bitmap.width
  const origHeight = bitmap.height
  const longest = Math.max(origWidth, origHeight)
  if (longest > COVER_WORK_MAX_SIDE) {
    const scale = COVER_WORK_MAX_SIDE / longest
    const smaller = await createImageBitmap(bitmap, { resizeWidth: Math.round(origWidth * scale), resizeHeight: Math.round(origHeight * scale), resizeQuality: 'high' })
    bitmap.close()
    bitmap = smaller
  }
  const previewScale = Math.min(1, COVER_PREVIEW_MAX / Math.max(bitmap.width, bitmap.height))
  const preview = document.createElement('canvas')
  preview.width = Math.round(bitmap.width * previewScale)
  preview.height = Math.round(bitmap.height * previewScale)
  drawWhite(preview).drawImage(bitmap, 0, 0, preview.width, preview.height)
  const blob = await toJpeg(preview, 0.85)
  const image: DecodedImage = {
    url: URL.createObjectURL(blob),
    width: bitmap.width,
    height: bitmap.height,
    origWidth,
    origHeight,
  }
  decoded.set(image, { bitmap, url: image.url })
  return image
}

function releaseImage(image: DecodedImage): void {
  const entry = decoded.get(image)
  if (!entry)
    return
  decoded.delete(image)
  entry.bitmap.close()
  URL.revokeObjectURL(entry.url)
}

async function exportCoverJpeg(image: DecodedImage, crop: CoverCrop): Promise<Blob> {
  const entry = decoded.get(image)
  if (!entry)
    throw new Error('这张图已经释放了，不能再裁')
  const canvas = document.createElement('canvas')
  canvas.width = COVER_OUTPUT_SIZE
  canvas.height = COVER_OUTPUT_SIZE
  drawWhite(canvas).drawImage(entry.bitmap, crop.x, crop.y, crop.size, crop.size, 0, 0, COVER_OUTPUT_SIZE, COVER_OUTPUT_SIZE)
  let quality = COVER_OUTPUT_QUALITY
  let blob = await toJpeg(canvas, quality)
  while (blob.size > COVER_OUTPUT_MAX_BYTES && quality > COVER_OUTPUT_MIN_QUALITY) {
    quality = Math.max(COVER_OUTPUT_MIN_QUALITY, Math.round((quality - 0.08) * 100) / 100)
    blob = await toJpeg(canvas, quality)
  }
  return blob
}

async function uploadCoverImage(url: string, jpeg: Blob, token: string, signal: AbortSignal): Promise<void> {
  const response = await window.fetch(url, {
    method: 'POST',
    headers: { 'x-nos-token': token, 'content-type': 'image/jpeg' },
    body: jpeg,
    signal,
  })
  if (!response.ok)
    throw new Error(`图片存储回了 ${response.status}`)
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
    images: { decode: decodeImage, release: releaseImage, exportJpeg: exportCoverJpeg },
    uploadCoverImage,
  }
}

import type { BrowserCapabilities } from './browser'

/**
 * 每项浏览器能力背后碰到的全局对象。App 里只能通过 BrowserCapabilities 拿这些能力，
 * 全局对象本身只准在 browser.ts 的实现里出现（browser.ts 不受这条限制）。
 *
 * 键和 BrowserCapabilities 一一对应：加一项能力就必须在这里登记它用到的全局对象，
 * 漏了会编译不过（satisfies 卡住），名单不会悄悄落后于契约。
 */
export const BROWSER_GLOBALS_BY_CAPABILITY = {
  fetch: ['fetch'],
  clock: ['setTimeout', 'setInterval', 'requestAnimationFrame'],
  indexedDB: ['indexedDB'],
  network: ['navigator'],
  page: ['document'],
  mediaSession: ['navigator'],
  MediaMetadata: ['MediaMetadata'],
  locks: ['navigator'],
  broadcastChannel: ['BroadcastChannel'],
  audio: ['Audio'],
  checkToken: ['window', 'document'],
  images: ['createImageBitmap', 'document'],
  uploadCoverImage: ['fetch'],
  download: ['fetch'],
  objectUrl: ['URL'],
  revokeObjectUrl: ['URL'],
} as const satisfies Record<keyof BrowserCapabilities, readonly string[]>

/** 不在 BrowserCapabilities 里、但同样只准在 browser.ts 用的全局对象 */
export const EXTRA_RESTRICTED_GLOBALS = [
  'self',
  'location',
  'localStorage',
  'sessionStorage',
] as const

/** 交给 eslint 的 no-restricted-globals：按能力登记的那些 + 额外禁止的那些 */
export const RESTRICTED_BROWSER_GLOBALS: readonly string[] = [
  ...new Set<string>([
    ...Object.values(BROWSER_GLOBALS_BY_CAPABILITY).flat(),
    ...EXTRA_RESTRICTED_GLOBALS,
  ]),
]

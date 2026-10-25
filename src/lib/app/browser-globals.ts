import type { BrowserCapabilities } from './browser'

/** App 只能通过 BrowserCapabilities 拿这些能力，全局对象只准在 browser.ts 里出现（它不受这条限制）；键和 BrowserCapabilities 一一对应，漏登记会编译不过（satisfies 卡住） */
const BROWSER_GLOBALS_BY_CAPABILITY = {
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
  storage: ['navigator'],
  objectUrl: ['URL'],
  revokeObjectUrl: ['URL'],
  pickFolder: ['showDirectoryPicker'],
} as const satisfies Record<keyof BrowserCapabilities, readonly string[]>

/** 不在 BrowserCapabilities 里、但同样只准在 browser.ts 用的全局对象 */
const EXTRA_RESTRICTED_GLOBALS = [
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

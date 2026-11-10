import type { BrowserCapabilities } from './browser';

const BROWSER_GLOBALS_BY_CAPABILITY = {
  fetch: ['fetch'],
  clock: ['setTimeout', 'setInterval', 'requestAnimationFrame'],
  indexedDB: ['indexedDB'],
  network: ['navigator'],
  page: ['document'],
  touchPrimary: ['matchMedia'],
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
} as const satisfies Record<keyof BrowserCapabilities, readonly string[]>;

const EXTRA_RESTRICTED_GLOBALS = [
  'self',
  'location',
  'localStorage',
  'sessionStorage',
] as const;

export const RESTRICTED_BROWSER_GLOBALS: readonly string[] = [
  ...new Set<string>([
    ...Object.values(BROWSER_GLOBALS_BY_CAPABILITY).flat(),
    ...EXTRA_RESTRICTED_GLOBALS,
  ]),
];

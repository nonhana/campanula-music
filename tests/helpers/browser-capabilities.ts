/**
 * 测试辅助：浏览器能力替身
 *
 * 提供可替换的浏览器能力，用于测试中模拟：
 * - 音频播放
 * - IndexedDB
 * - Background Fetch
 * - Media Session
 * - 页面可见性
 * - 联网状态
 * - 存储空间
 * - 时钟
 */

export interface AudioStub {
  play: () => Promise<void>
  pause: () => void
  currentTime: number
  duration: number
  ended: boolean
  onended: ((ev: Event) => void) | null
  onerror: ((ev: Event | string) => void) | null
}

export interface BrowserCapabilities {
  createAudio: (src: string) => AudioStub
  isOnline: () => boolean
  isVisible: () => boolean
  now: () => number
}

/**
 * 默认的浏览器能力（使用真实浏览器 API）
 */
export function createRealBrowserCapabilities(): BrowserCapabilities {
  return {
    createAudio: (src: string) => {
      const audio = new Audio(src)
      return {
        play: () => audio.play(),
        pause: () => audio.pause(),
        get currentTime() {
          return audio.currentTime
        },
        set currentTime(value: number) {
          audio.currentTime = value
        },
        get duration() {
          return audio.duration
        },
        get ended() {
          return audio.ended
        },
        get onended() {
          return audio.onended
        },
        set onended(handler: ((ev: Event) => void) | null) {
          audio.onended = handler
        },
        get onerror() {
          return audio.onerror
        },
        set onerror(handler: ((ev: Event | string) => void) | null) {
          audio.onerror = handler
        },
      }
    },
    isOnline: () => navigator.onLine,
    isVisible: () => document.visibilityState === 'visible',
    now: () => Date.now(),
  }
}

/**
 * 测试用的浏览器能力替身
 */
export function createTestBrowserCapabilities(): BrowserCapabilities {
  return {
    createAudio: (_src: string) => {
      return {
        play: async () => {},
        pause: () => {},
        currentTime: 0,
        duration: 180,
        ended: false,
        onended: null,
        onerror: null,
      }
    },
    isOnline: () => true,
    isVisible: () => true,
    now: () => Date.now(),
  }
}

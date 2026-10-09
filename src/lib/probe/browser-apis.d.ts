// 探针用到、TypeScript 自带类型里没有的浏览器接口，只声明用到的部分：
// Background Fetch（https://wicg.github.io/background-fetch/）、安装提示（beforeinstallprompt）、
// User-Agent Client Hints（navigator.userAgentData）、CloseWatcher（Android 返回手势）。

interface BackgroundFetchUIOptions {
  title?: string
  icons?: Array<{ src: string, sizes?: string, type?: string }>
}

interface BackgroundFetchOptions extends BackgroundFetchUIOptions {
  downloadTotal?: number
}

interface BackgroundFetchRecord {
  readonly request: Request
  readonly responseReady: Promise<Response>
}

interface BackgroundFetchRegistration extends EventTarget {
  readonly id: string
  readonly downloadTotal: number
  readonly downloaded: number
  readonly result: '' | 'success' | 'failure'
  readonly failureReason: '' | 'aborted' | 'bad-status' | 'fetch-error' | 'quota-exceeded' | 'download-total-exceeded'
  readonly recordsAvailable: boolean
  abort: () => Promise<boolean>
  matchAll: () => Promise<BackgroundFetchRecord[]>
}

interface BackgroundFetchManager {
  fetch: (id: string, requests: RequestInfo | RequestInfo[], options?: BackgroundFetchOptions) => Promise<BackgroundFetchRegistration>
  get: (id: string) => Promise<BackgroundFetchRegistration | undefined>
  getIds: () => Promise<string[]>
}

interface ServiceWorkerRegistration {
  readonly backgroundFetch?: BackgroundFetchManager
}

interface BackgroundFetchEvent extends ExtendableEvent {
  readonly registration: BackgroundFetchRegistration
}

interface BackgroundFetchUpdateUIEvent extends BackgroundFetchEvent {
  updateUI: (options?: BackgroundFetchUIOptions) => Promise<void>
}

interface ServiceWorkerGlobalScopeEventMap {
  backgroundfetchsuccess: BackgroundFetchUpdateUIEvent
  backgroundfetchfail: BackgroundFetchUpdateUIEvent
  backgroundfetchabort: BackgroundFetchEvent
  backgroundfetchclick: BackgroundFetchEvent
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed', platform: string }>
  prompt: () => Promise<void>
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent
  appinstalled: Event
}

interface NavigatorUAData {
  readonly brands: Array<{ brand: string, version: string }>
  readonly mobile: boolean
  readonly platform: string
  getHighEntropyValues: (hints: string[]) => Promise<Record<string, unknown>>
}

interface Navigator {
  readonly userAgentData?: NavigatorUAData
}

declare class CloseWatcher extends EventTarget {
  constructor(options?: { signal?: AbortSignal })
  requestClose(): void
  close(): void
  destroy(): void
  oncancel: ((event: Event) => void) | null
  onclose: ((event: Event) => void) | null
}

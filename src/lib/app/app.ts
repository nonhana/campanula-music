import type { AccountResponse } from '$lib/api/account'
import type { BrowserCapabilities } from './browser'

/** 登录会话。刚打开时要先问服务端，才知道有没有当前账号 */
export type Session
  = | { status: 'checking' }
    | { status: 'signedOut' }

export interface AppState {
  session: Session
  /** 曲库副本（ADR-0007）。未登录时没有 */
  library: null
}

/** 去掉界面的整个 App：界面读它的状态、把听众的操作交给它 */
export interface App {
  readonly state: AppState
  /** 打开 App：问服务端当前账号是谁 */
  open: () => Promise<void>
}

export function createApp(browser: BrowserCapabilities): App {
  let state: AppState = { session: { status: 'checking' }, library: null }

  return {
    get state() {
      return state
    },
    async open() {
      const response = await browser.fetch('/api/account')
      if (!response.ok)
        throw new Error(`问不到当前账号：HTTP ${response.status}`)
      const { account }: AccountResponse = await response.json()
      if (account === null)
        state = { ...state, session: { status: 'signedOut' } }
    },
  }
}

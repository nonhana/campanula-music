import type { AccountResponse } from '$lib/api/account'
import type { BrowserCapabilities } from './browser'

/**
 * 打开时没问到当前账号，所以不知道有没有登录：
 * 断网（offline）、联网了但请求没到服务端（unreachable）、服务端回了错误（serverError）
 */
export type CheckFailure = 'offline' | 'unreachable' | 'serverError'

/** 登录会话。刚打开时要先问服务端，才知道有没有当前账号 */
export type Session
  = | { status: 'checking' }
    | { status: 'checkFailed', reason: CheckFailure }
    | { status: 'signedOut' }

export interface AppState {
  session: Session
  /** 曲库副本（ADR-0007）。未登录时没有 */
  library: null
}

/** 去掉界面的整个 App：界面读它的状态、把听众的操作交给它 */
export interface App {
  readonly state: AppState
  /** 状态变了就调 listener；返回取消订阅的函数 */
  subscribe: (listener: () => void) => () => void
  /** 打开 App：问服务端当前账号是谁。没问到时可以再调一次重试 */
  open: () => Promise<void>
}

export function createApp(browser: BrowserCapabilities): App {
  let state: AppState = { session: { status: 'checking' }, library: null }
  const listeners = new Set<() => void>()

  function setSession(session: Session) {
    state = { ...state, session }
    for (const listener of listeners)
      listener()
  }

  /** 问服务端当前账号是谁；没问到时说明原因 */
  async function checkAccount(): Promise<Session> {
    // fetch 和读响应体只在网络出错时抛 TypeError（Fetch 标准的 network error），其他错误照常抛出
    const networkFailure = (error: unknown): Session => {
      if (!(error instanceof TypeError))
        throw error
      return { status: 'checkFailed', reason: browser.network.onLine ? 'unreachable' : 'offline' }
    }
    let response: Response
    try {
      response = await browser.fetch('/api/account')
    }
    catch (error) {
      return networkFailure(error)
    }
    if (!response.ok)
      return { status: 'checkFailed', reason: 'serverError' }
    let body: AccountResponse
    try {
      body = await response.json()
    }
    catch (error) {
      // 回了 200 却不是 JSON：中间的代理或强制门户（例如公共 Wi-Fi 的登录页）替服务端回的，没到 Campanula
      if (error instanceof SyntaxError)
        return { status: 'checkFailed', reason: 'unreachable' }
      return networkFailure(error)
    }
    if (body.account !== null) {
      // 登录（#19）之前只会是 null；类型放宽后这里编译不过，提醒补上已登录的情况
      const unhandled: never = body.account
      throw new Error(`还不会处理已登录的账号：${String(unhandled)}`)
    }
    return { status: 'signedOut' }
  }

  return {
    get state() {
      return state
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async open() {
      setSession({ status: 'checking' })
      setSession(await checkAccount())
    },
  }
}

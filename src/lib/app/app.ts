import type { Account, AccountResponse } from '$lib/api/account'
import type { LogoutResponse } from '$lib/api/login'
import type { RequestFailure } from './api'
import type { BrowserCapabilities } from './browser'
import type { LoginState } from './login'
import { createApi } from './api'
import { createLocalDb } from './local'
import { createLogin, INITIAL_LOGIN } from './login'

/**
 * 会改登录 Cookie 的请求排队用的跨标签页的锁：问当前账号（服务端可能在这一步续期、写回新的登录 Cookie）和退出。
 * 不排队的话，退出先回、续期后回，续期写回的登录 Cookie 会把刚退出的登录又带回来
 */
const LOGIN_COOKIE_LOCK = 'campanula:login-cookie'
/** 标签页之间同步登录会话的广播频道 */
const SESSION_CHANNEL = 'campanula:session'

/** 标签页之间广播的消息：这个浏览器退出登录了 */
interface SignedOutMessage {
  type: 'signedOut'
}

/** 登录会话。刚打开时要先问服务端，才知道有没有当前账号 */
export type Session
  = | { status: 'checking' }
  /** 没问到当前账号，不知道有没有登录（网易云说需要登录时是 loginExpired，不在这里） */
    | { status: 'checkFailed', failure: Exclude<RequestFailure, { kind: 'needsLogin' }> }
    | { status: 'signedOut' }
  /** 浏览器里还有登录 Cookie，但网易云说登录已经失效 */
    | { status: 'loginExpired' }
    | { status: 'signedIn', account: Account }

export interface AppState {
  session: Session
  /** 登录页：扫码和短信验证码两种方式走到哪一步 */
  login: LoginState
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
  /** 显示一张新的登录二维码，查询扫码状态直到登录成功、过期或出错；也用来刷新、重试 */
  startQrLogin: () => Promise<void>
  /** 不再显示二维码（换成短信验证码、离开登录页）：停止查询 */
  stopQrLogin: () => void
  /** 网易云要求行为验证时，听众在手机上验证完了：再查一次扫码状态 */
  continueQrLogin: () => Promise<void>
  /** 给中国大陆手机号（+86）发短信验证码 */
  sendCaptcha: (phone: string) => Promise<void>
  loginWithCaptcha: (phone: string, captcha: string) => Promise<void>
  /**
   * 退出登录：App 马上当作未登录。服务端调网易云的退出、回过期的登录 Cookie；
   * 断网或服务端出错时 Cookie 删不掉，记下来，联网后、下次打开时再发（ADR-0003）
   */
  logout: () => Promise<void>
}

export function createApp(browser: BrowserCapabilities): App {
  const api = createApi(browser)
  const local = createLocalDb(browser.indexedDB)
  let state: AppState = { session: { status: 'checking' }, login: INITIAL_LOGIN, library: null }
  const listeners = new Set<() => void>()

  function update(next: Partial<AppState>) {
    state = { ...state, ...next }
    for (const listener of listeners)
      listener()
  }

  /**
   * 还没发出去的退出：发出去，服务端回了过期的登录 Cookie 才算完。没发成时返回原因：
   * 这时浏览器里还留着上一个登录 Cookie，不能接着登录，否则之后补发的退出会把新的登录也退掉
   */
  let finishingLogout: Promise<RequestFailure | null> | undefined
  function finishLogout(): Promise<RequestFailure | null> {
    finishingLogout ??= browser.locks.request(LOGIN_COOKIE_LOCK, async () => {
      if (!await local.pendingLogout())
        return null
      const result = await api.post<LogoutResponse>('/api/logout')
      if (!result.ok)
        return result.failure
      await local.setPendingLogout(false)
      return null
    }).finally(() => {
      finishingLogout = undefined
    })
    return finishingLogout
  }
  browser.network.addEventListener('online', () => void finishLogout())

  const login = createLogin({
    api,
    clock: browser.clock,
    page: browser.page,
    beforeLogin: finishLogout,
    read: () => state.login,
    write: next => update({ login: next }),
    signedIn: account => update({ session: { status: 'signedIn', account }, login: INITIAL_LOGIN }),
  })

  /** 每退出一次就加一：退出之前发出去的问账号回来时，结果就不要了 */
  let signOuts = 0
  function signedOut(): void {
    signOuts += 1
    login.stopQr()
    update({ session: { status: 'signedOut' }, login: INITIAL_LOGIN })
  }

  // 一个标签页退出，同一浏览器里开着的其他标签页跟着变成未登录（退出请求由退出的那个标签页发）
  const sessionChannel = browser.broadcastChannel(SESSION_CHANNEL)
  sessionChannel.addEventListener('message', (event) => {
    if ((event.data as SignedOutMessage).type === 'signedOut')
      signedOut()
  })

  /** 问服务端当前账号是谁；没问到时说明原因 */
  async function checkAccount(): Promise<Session> {
    const result = await api.get<AccountResponse>('/api/account')
    if (result.ok)
      return result.value.account ? { status: 'signedIn', account: result.value.account } : { status: 'signedOut' }
    if (result.failure.kind === 'needsLogin')
      return { status: 'loginExpired' }
    return { status: 'checkFailed', failure: result.failure }
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
      update({ session: { status: 'checking' } })
      if (await local.pendingLogout()) {
        await finishLogout()
        update({ session: { status: 'signedOut' } })
        return
      }
      // 服务端在这一步里续期（满 24 小时、或网易云说需要登录时）。同一浏览器的标签页排队问：
      // 前一个续期拿到的新登录 Cookie，后一个直接带上，不会再续一次
      const asked = signOuts
      const session = await browser.locks.request(LOGIN_COOKIE_LOCK, checkAccount)
      if (signOuts === asked)
        update({ session })
    },
    startQrLogin: login.startQr,
    stopQrLogin: login.stopQr,
    continueQrLogin: login.continueQr,
    sendCaptcha: login.sendCaptcha,
    loginWithCaptcha: login.loginWithCaptcha,
    async logout() {
      await local.setPendingLogout(true)
      signedOut()
      sessionChannel.postMessage({ type: 'signedOut' } satisfies SignedOutMessage)
      await finishLogout()
    },
  }
}

import type { Account } from '#lib/api/account.js'
import type { GetEndpoint, PostEndpoint } from '#lib/api/endpoint.js'
import { endpoints } from '#lib/api/endpoints.js'

import type { Api, BodyArg, ParamsArg, PostOptions, RequestFailure, Result } from './api-client'
import type { BackgroundLane, Waiting } from './pacing'

// 会话一轮（#69）：登录、退出、登录失效时换一轮，一轮里的请求都绑定在换轮前的编号上。这一轮结束时还在路上的请求回来直接丢掉；
// 网易云说需要登录只在这里变成“这一轮登录失效”、只处理一次，旧一轮回来的 401 不会让新一轮过期，交给模块的失败已经去掉 needsLogin。
// 模块在这里登记会话换了要做的清理，App 不用维护两份清单；后台通道的请求节奏仍由 pacing 管，这里只把结果绑到轮次上并在换轮时停/开它。

/** 需要登录已经由会话一轮处理掉了（这一轮结束，回复直接丢） */
export type SessionFailure = Exclude<RequestFailure, { kind: 'needsLogin' }>
/** null = 这一轮已经结束，回复直接丢；未登录的当前轮也直接回 null、不发请求（request/background 都会先看 signedIn） */
export type SessionResult<T> = { ok: true, value: T } | { ok: false, failure: SessionFailure } | null
/** 请求节奏已经等过操作频繁和断网，这一轮也还算数时的失败 */
export type BackgroundFailure = Exclude<SessionFailure, { kind: 'rateLimited' | 'offline' }>
export type BackgroundSessionResult<T> = { ok: true, value: T } | { ok: false, failure: BackgroundFailure } | null

/** 刚打开时要先问服务端，才知道有没有当前账号 */
export type Session
  = | { status: 'checking' }
    /** 没问到当前账号（网易云说需要登录时是 loginExpired，不在这里） */
    | { status: 'checkFailed', failure: SessionFailure }
    | { status: 'signedOut' }
    /** 浏览器里还有登录 Cookie，但网易云说登录已经失效 */
    | { status: 'loginExpired' }
    | { status: 'signedIn', account: Account }

type SessionChange
  = | { kind: 'anonymous' }
    | { kind: 'signedIn', account: Account }
    | { kind: 'signedOut', by: 'this-tab' | 'other-tab' }
    | { kind: 'loginExpired' }

export interface SessionApi {
  get: <Params, Response>(endpoint: GetEndpoint<Params, Response>, ...args: ParamsArg<Params>) => Promise<SessionResult<Response>>
  post: <Params, Request, Response>(endpoint: PostEndpoint<Params, Request, Response>, ...args: [...ParamsArg<Params>, ...BodyArg<Request>, options?: PostOptions]) => Promise<SessionResult<Response>>
  /**
   * 直接发一个端点目录的调用：需要把同一个 send 先交给后台通道、听众打开时再改成前台时用。
   * 未登录时直接回 null，不发请求
   */
  request: <T>(send: () => Promise<Result<T>>) => Promise<SessionResult<T>>
}

export interface SessionRound {
  readonly api: SessionApi
  /** 本机异步写盘做完后，用它核对还是不是这一轮 */
  readonly current: number
  isCurrent: (round: number) => boolean
  /** 这一轮结束时回 null，旧回复直接丢；只有当前一轮的 needsLogin 让 App 变成登录失效 */
  background: <T>(send: () => Promise<Result<T>>, onWaiting: (waiting: Waiting | null) => void, giveUp?: AbortSignal) => Promise<BackgroundSessionResult<T> | 'gaveUp'>
  /** 刚换过轮时是 null，结果不要了 */
  checkAccount: () => Promise<Session | null>
  /** 返回取消订阅 */
  onChange: (listener: (change: SessionChange) => void | Promise<void>) => () => void
  /** 先换轮、停/开后台通道，再通知各模块 */
  change: (change: SessionChange) => Promise<void>
}

/** 是 needsLogin 时返回 null（调用方负责让这一轮结束） */
const withoutNeedsLogin = (failure: RequestFailure): SessionFailure | null => failure.kind === 'needsLogin'
  ? null
  : failure

export const createSessionRound = ({ api, lane, expired }: { api: Api, lane: BackgroundLane, expired: () => void }): SessionRound => {
  let current = 1
  /** 没登录时的 401 不当成“登录失效” */
  let signedIn = false
  const listeners = new Set<(change: SessionChange) => void | Promise<void>>()

  /** 这一轮已经换过就丢掉；还是这一轮而网易云说要登录就让 App 变成登录失效（一次），已经登录着才叫登录失效 */
  const settle = async <T>(pending: Promise<Result<T>>, mine: number): Promise<SessionResult<T>> => {
    const result = await pending
    if (mine !== current)
      return null
    if (result.ok)
      return result
    const failure = withoutNeedsLogin(result.failure)
    if (!failure) {
      if (signedIn)
        expired()
      return null
    }
    return { ok: false, failure }
  }

  const request = <T>(send: () => Promise<Result<T>>): Promise<SessionResult<T>> => {
    const mine = current
    if (!signedIn)
      return Promise.resolve(null)
    return settle(send(), mine)
  }

  const apiRound: SessionApi = {
    get(endpoint, ...args) {
      return request(() => api.get(endpoint, ...args))
    },
    post(endpoint, ...args) {
      return request(() => api.post(endpoint, ...args))
    },
    request,
  }

  const background = async <T>(send: () => Promise<Result<T>>, onWaiting: (waiting: Waiting | null) => void, giveUp?: AbortSignal): Promise<BackgroundSessionResult<T> | 'gaveUp'> => {
    const mine = current
    if (!signedIn)
      return null
    const result = await lane.send(send, onWaiting, giveUp)
    if (!result)
      return 'gaveUp'
    const settled = await settle(Promise.resolve(result), mine)
    if (!settled)
      return null
    if (settled.ok)
      return settled
    // 请求节奏已经等过这两类；这里只剩会话结束和别的失败
    switch (settled.failure.kind) {
      case 'rateLimited':
      case 'offline':
        return null
      default:
        return { ok: false, failure: settled.failure }
    }
  }

  const checkAccount = async (): Promise<Session | null> => {
    const mine = current
    const result = await api.get(endpoints.account)
    if (mine !== current)
      return null
    if (result.ok) {
      return result.value.account
        ? { status: 'signedIn', account: result.value.account }
        : { status: 'signedOut' }
    }
    if (result.failure.kind === 'needsLogin')
      return { status: 'loginExpired' }
    const failure = withoutNeedsLogin(result.failure)
    return failure
      ? { status: 'checkFailed', failure }
      : null
  }

  const change = async (next: SessionChange): Promise<void> => {
    // 这一行必须同步执行：第一个 needsLogin 在这里加一后，同一轮里后来的 401 才会被 settle 丢掉
    current += 1
    signedIn = next.kind === 'signedIn'
    if (signedIn)
      lane.resume()
    else
      lane.stop()
    const settled = await Promise.allSettled([...listeners].map(async listener => listener(next)))
    for (const result of settled) {
      if (result.status === 'rejected')
        console.error('会话切换清理失败', next.kind, result.reason)
    }
  }

  return {
    api: apiRound,
    get current() {
      return current
    },
    isCurrent: round => round === current,
    background,
    checkAccount,
    onChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    change,
  }
}

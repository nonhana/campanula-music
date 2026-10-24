import type { RequestFailure, Result } from './api-client'
import type { Clock, NetworkStatus } from './browser'

// 请求节奏（Spec #11“客户端：请求节奏”，逻辑原型“原型证明有必要的做法”第 1 条）：前台请求（登录、退出、取播放地址、提交修改）
// 直接用 Api 发、不排在后台请求后面；后台请求（同步、取下载地址、补发听歌打卡）经过这里，不设同时请求数上限（验证关卡①后作者定）。
// 网易云说“操作频繁”就把所有后台请求停到它给的时间再重发被拒的，断网就等联网；退出、登录失效时停掉全部后台请求直到重新登录。
// 哪一轮会话有效由会话一轮判断：这里只负责“操作频繁/断网”的等待，以及被停止时马上了结。

export type Waiting
  /** 等到 until（毫秒） */
  = | { reason: 'rateLimited', until: number }
    /** 等联网 */
    | { reason: 'offline' }

/** 操作频繁和断网由这里等过、重发过，不会交给调用方 */
type BackgroundResult<T> = { ok: true, value: T } | { ok: false, failure: Exclude<RequestFailure, { kind: 'rateLimited' | 'offline' }> }

export interface BackgroundLane {
  /**
   * request 每次调用发一次（被拒后重发会再调）；onWaiting 在开始等时收到在等什么，等完要发出去时收到 null。
   * giveUp 在等的时候、或者被拒后要重发之前收到就不再发、返回 null；请求已经在路上时照常等它回来。
   */
  send: <T>(request: () => Promise<Result<T>>, onWaiting: (waiting: Waiting | null) => void, giveUp?: AbortSignal) => Promise<BackgroundResult<T> | null>
  /** 等着的后台请求马上了结，之后发的也一样，直到重新登录 */
  stop: () => void
  resume: () => void
}

const NEEDS_LOGIN = {
  ok: false,
  failure: { kind: 'needsLogin' },
} as const

export const createBackgroundLane = ({ clock, network }: { clock: Clock, network: NetworkStatus }): BackgroundLane => {
  /** 到这个时间（毫秒）之前后台请求都不发 */
  let pausedUntil = 0
  let stopped = false
  /** 被停掉的那次 send 就算后来 resume 了也不再继续等；新 send 拿新的编号 */
  let epoch = 0
  const sleepers = new Set<() => void>()

  const sleep = (wake: { until: number } | 'online', giveUp: AbortSignal | undefined): Promise<void> => new Promise((resolve) => {
    let cancelTimer = (): void => {}
    const done = () => {
      sleepers.delete(done)
      cancelTimer()
      network.removeEventListener('online', done)
      giveUp?.removeEventListener('abort', done)
      resolve()
    }
    sleepers.add(done)
    giveUp?.addEventListener('abort', done)
    if (wake === 'online')
      network.addEventListener('online', done)
    else
      cancelTimer = clock.after(wake.until - clock.now(), done)
  })

  const stop = (): void => {
    stopped = true
    epoch += 1
    for (const wake of [...sleepers])
      wake()
  }

  return {
    async send<T>(request: () => Promise<Result<T>>, onWaiting: (waiting: Waiting | null) => void, giveUp?: AbortSignal): Promise<BackgroundResult<T> | null> {
      const mine = epoch
      for (;;) {
        if (stopped || epoch !== mine)
          return NEEDS_LOGIN
        if (giveUp?.aborted)
          return null
        if (pausedUntil > clock.now()) {
          onWaiting({ reason: 'rateLimited', until: pausedUntil })
          await sleep({ until: pausedUntil }, giveUp)
          continue
        }
        if (!network.onLine) {
          onWaiting({ reason: 'offline' })
          await sleep('online', giveUp)
          continue
        }
        onWaiting(null)
        const result = await request()
        if (result.ok)
          return result
        const { failure } = result
        switch (failure.kind) {
          case 'rateLimited':
            pausedUntil = Math.max(pausedUntil, clock.now() + failure.retryAfter * 1000)
            continue
          case 'offline':
            continue
          case 'needsLogin':
            // 交给会话一轮：这一轮还算数时它让 App 变成登录失效，并停掉后台通道；旧一轮回来的回 401 已经由它丢掉
            return { ok: false, failure }
          default:
            return { ok: false, failure }
        }
      }
      return NEEDS_LOGIN
    },
    stop,
    resume() {
      stopped = false
    },
  }
}

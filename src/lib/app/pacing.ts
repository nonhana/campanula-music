import type { RequestFailure, Result } from './api'
import type { Clock, NetworkStatus } from './browser'

// 请求节奏（Spec #11“客户端：请求节奏”，逻辑原型“原型证明有必要的做法”第 1 条）：
// - 前台请求（听众正在等的：登录、退出、之后的取播放地址、提交修改）直接用 Api 发，不经过这里，不排在后台请求后面；
// - 后台请求（同步，之后的取下载地址、补发听歌打卡）经过这里。不设同时请求数上限（验证关卡①后作者定）；
//   网易云说“操作频繁”，所有后台请求停到它给的时间，再把被拒的重发；断网就等联网再发；
// - 登录失效（网易云说需要登录、续期也没成功）或退出：等着的后台请求都停下来，之后的也一样，直到重新登录。
//   哪一轮会话有效由会话一轮（session-round）判断：这里只负责“操作频繁/断网”的等待，以及被停止时马上了结。

/** 后台请求在等什么 */
export type Waiting
  /** 网易云说操作频繁：等到 until（毫秒） */
  = | { reason: 'rateLimited', until: number }
  /** 断网了：等联网 */
    | { reason: 'offline' }

/** 后台请求的结果：操作频繁和断网由这里等过、重发过，不会交给调用方 */
export type BackgroundResult<T> = { ok: true, value: T } | { ok: false, failure: Exclude<RequestFailure, { kind: 'rateLimited' | 'offline' }> }

export interface BackgroundLane {
  /**
   * 发一个后台请求。request 每次调用发一次（被拒后重发会再调）；
   * onWaiting 在开始等（操作频繁、断网）时收到在等什么，等完要发出去时收到 null。
   * giveUp：调用方不想再等了（听众打开了这张歌单，要改成前台请求马上发）。在等的时候、或者被拒后要重发之前
   * 收到它，就不再发，返回 null；请求已经在路上时照常等它回来
   */
  send: <T>(request: () => Promise<Result<T>>, onWaiting: (waiting: Waiting | null) => void, giveUp?: AbortSignal) => Promise<BackgroundResult<T> | null>
  /** 会话结束（退出、登录失效）：等着的后台请求马上了结，之后发的也一样，直到重新登录 */
  stop: () => void
  /** 新一轮会话开始了：后台请求照常发 */
  resume: () => void
}

const NEEDS_LOGIN = { ok: false, failure: { kind: 'needsLogin' } } as const

export function createBackgroundLane({ clock, network }: { clock: Clock, network: NetworkStatus }): BackgroundLane {
  /** 网易云说操作频繁：到这个时间（毫秒）之前后台请求都不发 */
  let pausedUntil = 0
  let stopped = false
  /** 每 stop() 一次加一：被停掉的那次 send 就算后来 resume 了也不再继续等；新 send 拿新的编号 */
  let epoch = 0
  /** 正在等的后台请求：stop() 时叫醒它们 */
  const sleepers = new Set<() => void>()

  /** 等到 until，或联网，或被 stop() 叫醒，或调用方不等了 */
  function sleep(wake: { until: number } | 'online', giveUp: AbortSignal | undefined): Promise<void> {
    return new Promise((resolve) => {
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
  }

  function stop(): void {
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

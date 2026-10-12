import type { RequestFailure, Result } from './api'
import type { Clock, NetworkStatus } from './browser'

// 请求节奏（Spec #11“客户端：请求节奏”，逻辑原型“原型证明有必要的做法”第 1 条）：
// - 前台请求（听众正在等的：登录、退出、之后的取播放地址、提交修改）直接用 Api 发，不经过这里，不排在后台请求后面；
// - 后台请求（同步，之后的取下载地址、补发听歌打卡）经过这里。不设同时请求数上限（验证关卡①后作者定）；
//   网易云说“操作频繁”，所有后台请求停到它给的时间，再把被拒的重发；断网就等联网再发；
// - 登录失效（网易云说需要登录、续期也没成功）或退出：等着的后台请求都按需要登录处理，之后的也一样，直到重新登录。

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
   * onWaiting 在开始等（操作频繁、断网）时收到在等什么，等完要发出去时收到 null
   */
  send: <T>(request: () => Promise<Result<T>>, onWaiting: (waiting: Waiting | null) => void) => Promise<BackgroundResult<T>>
  /** 登录失效或退出：等着的后台请求马上按需要登录了结，之后发的也一样 */
  stop: () => void
  /** 重新登录了：后台请求照常发 */
  resume: () => void
}

const NEEDS_LOGIN = { ok: false, failure: { kind: 'needsLogin' } } as const

export function createBackgroundLane({ clock, network }: { clock: Clock, network: NetworkStatus }): BackgroundLane {
  /** 网易云说操作频繁：到这个时间（毫秒）之前后台请求都不发 */
  let pausedUntil = 0
  let stopped = false
  /** 每 stop() 一次加一：stop 之前开始的请求就算之后 resume() 了，也不再等、不再发 */
  let epoch = 0
  /** 正在等的后台请求：stop() 时叫醒它们 */
  const sleepers = new Set<() => void>()

  /** 等到 until，或联网，或被 stop() 叫醒 */
  function sleep(wake: { until: number } | 'online'): Promise<void> {
    return new Promise((resolve) => {
      let cancelTimer = (): void => {}
      const done = () => {
        sleepers.delete(done)
        cancelTimer()
        network.removeEventListener('online', done)
        resolve()
      }
      sleepers.add(done)
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
    async send<T>(request: () => Promise<Result<T>>, onWaiting: (waiting: Waiting | null) => void): Promise<BackgroundResult<T>> {
      const mine = epoch
      while (!stopped && epoch === mine) {
        if (pausedUntil > clock.now()) {
          onWaiting({ reason: 'rateLimited', until: pausedUntil })
          await sleep({ until: pausedUntil })
          continue
        }
        if (!network.onLine) {
          onWaiting({ reason: 'offline' })
          await sleep('online')
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
            // 只在当前 epoch 的 needsLogin 才停后台通道：退出前发出的请求在重新登录后才回 401 时，不要停新会话的通道
            if (epoch === mine)
              stop()
            return NEEDS_LOGIN
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

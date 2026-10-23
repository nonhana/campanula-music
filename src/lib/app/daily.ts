import type { Song } from '#lib/api/library.js'
import type { Api, RequestFailure } from './api'
import type { Clock } from './browser'
import { endpoints } from '#lib/api/endpoints.js'

// 每日推荐（#29，Spec #11“发现”）：听众打开时用前台请求拉，只在这次登录期间记着，不存本机：
// 断网时说明要联网。网易云每天北京时间 6:00 换一份，记着的不是今天这份就重新拉。

/** 北京时间比 UTC 早 8 小时 */
const BEIJING_OFFSET = 8 * 3600_000
/** 网易云每天换每日推荐的时刻：北京时间 6:00 */
const REFRESH_AT = 6 * 3600_000

/** now（毫秒）时网易云给的是哪一天的每日推荐：北京时间的日期，6:00 之前还是前一天的。写成 YYYY-MM-DD */
export function dailyDayAt(now: number): string {
  return new Date(now + BEIJING_OFFSET - REFRESH_AT).toISOString().slice(0, 10)
}

/** 每日推荐没拉到的原因（需要登录另外处理：整个 App 变成登录失效） */
export type DailyFailure = Exclude<RequestFailure, { kind: 'needsLogin' }>

/** 每日推荐拉到哪了。day 是哪一天的（dailyDayAt） */
export type DailyState
  = | { day: string, status: 'loading' }
  /** 没拉到：说明原因，再打开一次就是重试 */
    | { day: string, status: 'failed', failure: DailyFailure }
    | { day: string, status: 'shown', songs: readonly Song[] }

export interface DailyContext {
  api: Api
  clock: Clock
  read: () => DailyState | null
  write: (daily: DailyState | null) => void
  /** 网易云说需要登录，续期也没成功 */
  loginExpired: () => void
}

export interface Daily {
  /** 打开每日推荐：今天这份已经拉到、正在拉就不再拉；没拉过、上次没拉成、记着的是前一天的就拉 */
  open: () => Promise<void>
  /** 退出登录、登录失效：不再显示，在路上的请求回来也不要了 */
  clear: () => void
}

export function createDaily(context: DailyContext): Daily {
  const { api } = context
  /** 每拉一次、清掉一次就加一：回来的不是最近一次拉的就不要了 */
  let attempt = 0

  return {
    async open() {
      const day = dailyDayAt(context.clock.now())
      const shown = context.read()
      if (shown?.day === day && shown.status !== 'failed')
        return
      const mine = ++attempt
      context.write({ day, status: 'loading' })
      const result = await api.get(endpoints.daily)
      if (mine !== attempt)
        return
      if (result.ok)
        return context.write({ day, status: 'shown', songs: result.value.songs })
      // 登录失效时 App 会清掉每日推荐（clear）
      if (result.failure.kind === 'needsLogin')
        return context.loginExpired()
      context.write({ day, status: 'failed', failure: result.failure })
    },
    clear() {
      attempt += 1
      context.write(null)
    },
  }
}

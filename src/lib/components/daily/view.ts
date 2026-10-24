import type { Song } from '#lib/api/library.js'
import type { PlaySource } from '#lib/api/playback.js'
import type { DailyFailure, DailyState } from '#lib/app/daily.js'
import { dailyDayAt } from '#lib/app/daily.js'
import { failureText } from '../shared/failure'

// 每日推荐在界面上怎么写：哪一天、一共多长、没拉成时怎么说

/** 从每日推荐放进播放队列的歌的播放来源 */
export const DAILY_SOURCE: PlaySource = { kind: 'daily' }

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'] as const

/** 日历上的一天：几月、几号、星期几 */
export interface CalendarDay {
  month: number
  day: number
  weekday: string
}

/**
 * 每日推荐是哪一天的：拉过的就是那一份的日期；还没打开过时按这台设备现在的时间算网易云给的是哪天（北京时间 6:00 换）。
 * 还没打开过时 App 里没有日期，界面直接读时钟：开着 App 过了 6:00，日历按钮上的数字要等打开每日推荐才换
 */
export function dailyCalendarDay(daily: DailyState | null): CalendarDay {
  const date = new Date(`${daily?.day ?? dailyDayAt(Date.now())}T00:00:00Z`)
  return { month: date.getUTCMonth() + 1, day: date.getUTCDate(), weekday: WEEKDAYS[date.getUTCDay()] }
}

/** 一共多长：不到一小时写“54 分钟”，否则“1 小时 54 分钟” */
export function totalDuration(songs: readonly Song[]): string {
  const minutes = Math.round(songs.reduce((sum, song) => sum + song.duration, 0) / 60_000)
  return minutes >= 60 ? `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟` : `${minutes} 分钟`
}

/**
 * 没拉成时怎么说：断网时标题说要联网，不写正文；别的正文是原因。
 * title、body 给每日推荐页的出错状态，brief 给首页方块上首数那一行
 */
export function dailyFailure(failure: DailyFailure): { title: string, body?: string, brief: string } {
  if (failure.kind === 'offline')
    return { title: '每日推荐要联网才能看', brief: '要联网才能看' }
  return { title: '今天的每日推荐没能加载', body: failureText(failure), brief: '没能加载' }
}

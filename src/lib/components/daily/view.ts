import type { Song } from '#lib/api/library.js';
import type { PlaySource } from '#lib/api/playback.js';
import type { DailyFailure, DailyState } from '#lib/app/daily.js';
import { dailyDayAt } from '#lib/app/daily.js';

import { failureText } from '../shared/failure';

export const DAILY_SOURCE: PlaySource = { kind: 'daily' };

const WEEKDAYS = [
  '星期日',
  '星期一',
  '星期二',
  '星期三',
  '星期四',
  '星期五',
  '星期六',
] as const;

export interface CalendarDay {
  month: number;
  day: number;
  weekday: string;
}

/** 拉过的用那一份的日期；没打开过时按设备时间算（北京时间 6:00 换），读的是这一次的时钟 */
export const dailyCalendarDay = (daily: DailyState | null): CalendarDay => {
  const date = new Date(`${daily?.day ?? dailyDayAt(Date.now())}T00:00:00Z`);
  return {
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekday: WEEKDAYS[date.getUTCDay()],
  };
};

export const totalDuration = (songs: readonly Song[]): string => {
  const minutes = Math.round(
    songs.reduce((sum, song) => sum + (song.duration ?? 0), 0) / 60_000,
  );
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`
    : `${minutes} 分钟`;
};

export const dailyFailure = (
  failure: DailyFailure,
): { title: string; body?: string; brief: string } => {
  if (failure.kind === 'offline')
    return { title: '每日推荐要联网才能看', brief: '要联网才能看' };
  return {
    title: '今天的每日推荐没能加载',
    body: failureText(failure),
    brief: '没能加载',
  };
};

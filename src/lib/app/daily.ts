import { endpoints } from '#lib/api/endpoints.js';
import type { Song } from '#lib/api/library.js';

import type { Clock } from './browser';
import type { SessionApi, SessionFailure, SessionRound } from './session-round';

const BEIJING_OFFSET = 8 * 3600_000;
const REFRESH_AT = 6 * 3600_000;

// 网易云每天北京时间 6:00 换一份，6:00 之前算前一天
export const dailyDayAt = (now: number): string =>
  new Date(now + BEIJING_OFFSET - REFRESH_AT).toISOString().slice(0, 10);

export type DailyFailure = SessionFailure;

export type DailyState =
  | { day: string; status: 'loading' }
  | { day: string; status: 'failed'; failure: DailyFailure }
  | { day: string; status: 'shown'; songs: readonly Song[] };

export interface DailyContext {
  api: SessionApi;
  session: SessionRound;
  clock: Clock;
  read: () => DailyState | null;
  write: (daily: DailyState | null) => void;
}

export interface Daily {
  open: () => Promise<void>;
}

export const createDaily = (context: DailyContext): Daily => {
  const { api } = context;

  const clear = (): void => {
    context.write(null);
  };

  context.session.onChange((change) => {
    if (change.kind !== 'signedIn') clear();
  });

  return {
    async open() {
      const day = dailyDayAt(context.clock.now());
      const shown = context.read();
      if (shown?.day === day && shown.status !== 'failed') return;
      context.write({ day, status: 'loading' });
      const result = await api.get(endpoints.daily);
      if (!result) return;
      if (context.read()?.day !== day) return;
      if (result.ok)
        return context.write({
          day,
          status: 'shown',
          songs: result.value.songs,
        });
      context.write({ day, status: 'failed', failure: result.failure });
    },
  };
};

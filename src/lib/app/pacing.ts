import type { RequestFailure, Result } from './api-client';
import type { Clock, NetworkStatus } from './browser';

export type Waiting =
  | { reason: 'rateLimited'; until: number }
  | { reason: 'offline' };

type BackgroundResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      failure: Exclude<RequestFailure, { kind: 'rateLimited' | 'offline' }>;
    };

export interface BackgroundLane {
  send: <T>(
    request: () => Promise<Result<T>>,
    onWaiting: (waiting: Waiting | null) => void,
    giveUp?: AbortSignal,
  ) => Promise<BackgroundResult<T> | null>;
  stop: () => void;
  resume: () => void;
}

const NEEDS_LOGIN = {
  ok: false,
  failure: { kind: 'needsLogin' },
} as const;

export const createBackgroundLane = ({
  clock,
  network,
}: {
  clock: Clock;
  network: NetworkStatus;
}): BackgroundLane => {
  let pausedUntil = 0;
  let stopped = false;
  // 被停掉的 send 后来 resume 了也不再继续等；新 send 拿新的编号
  let epoch = 0;
  const sleepers = new Set<() => void>();

  const sleep = (
    wake: { until: number } | 'online',
    giveUp: AbortSignal | undefined,
  ): Promise<void> =>
    new Promise((resolve) => {
      let cancelTimer = (): void => {};
      const done = () => {
        sleepers.delete(done);
        cancelTimer();
        network.removeEventListener('online', done);
        giveUp?.removeEventListener('abort', done);
        resolve();
      };
      sleepers.add(done);
      giveUp?.addEventListener('abort', done);
      if (wake === 'online') network.addEventListener('online', done);
      else cancelTimer = clock.after(wake.until - clock.now(), done);
    });

  const stop = (): void => {
    stopped = true;
    epoch += 1;
    for (const wake of [...sleepers]) wake();
  };

  return {
    async send<T>(
      request: () => Promise<Result<T>>,
      onWaiting: (waiting: Waiting | null) => void,
      giveUp?: AbortSignal,
    ): Promise<BackgroundResult<T> | null> {
      const mine = epoch;
      for (;;) {
        if (stopped || epoch !== mine) return NEEDS_LOGIN;
        if (giveUp?.aborted) return null;
        if (pausedUntil > clock.now()) {
          onWaiting({ reason: 'rateLimited', until: pausedUntil });
          await sleep({ until: pausedUntil }, giveUp);
          continue;
        }
        if (!network.onLine) {
          onWaiting({ reason: 'offline' });
          await sleep('online', giveUp);
          continue;
        }
        onWaiting(null);
        const result = await request();
        if (result.ok) return result;
        const { failure } = result;
        switch (failure.kind) {
          case 'rateLimited':
            pausedUntil = Math.max(
              pausedUntil,
              clock.now() + failure.retryAfter * 1000,
            );
            continue;
          case 'offline':
            continue;
          case 'needsLogin':
            // 交给会话一轮让它变成登录失效、停掉后台通道，旧一轮的 401 它已经丢掉
            return { ok: false, failure };
          default:
            return { ok: false, failure };
        }
      }
      return NEEDS_LOGIN;
    },
    stop,
    resume() {
      stopped = false;
    },
  };
};

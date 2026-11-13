import { endpoints } from '#lib/api/endpoints.js';
import type { WriteResponse } from '#lib/api/write.js';

import type { Api, Result } from './api-client';
import type { LocksCapability } from './browser';
import type { PendingCheckIn, PendingCheckIns } from './saved-queue';
import type { SessionRound } from './session-round';

// 同一浏览器的标签页共用本机打卡，同时只让一个标签页发，免得一条发两次
const CHECK_IN_LOCK = 'campanula:check-ins';

export interface CheckInsContext {
  api: Api;
  session: SessionRound;
  store: PendingCheckIns;
  locks: LocksCapability;
  account: () => number | null;
}

export interface CheckIns {
  send: () => void;
  sendBeforeLogout: (owner: number) => Promise<void>;
}

const postCheckIn = (
  api: Api,
  { songId, source, seconds }: PendingCheckIn,
): Promise<Result<WriteResponse>> =>
  api.post(endpoints.checkIn, { id: songId }, { source, seconds });

export const createCheckIns = (context: CheckInsContext): CheckIns => {
  const { api, session, store, locks, account } = context;
  let sending: Promise<void> | null = null;
  let again = false;

  const sendAll = async (owner: number): Promise<void> => {
    // 一条条发、别改成并发：网易云按收到的先后排最近播放
    for (const { key, checkIn } of await store.all()) {
      if (account() !== owner) return;
      if (checkIn.owner !== owner) {
        await store.remove(key);
        continue;
      }
      const result = await session.background(
        () => postCheckIn(api, checkIn),
        () => {},
      );
      if (result === null || result === 'gaveUp') return;
      if (result.ok) {
        await store.remove(key);
        continue;
      }
      switch (result.failure.kind) {
        case 'unreachable':
        case 'serverError':
        case 'neteaseUnavailable':
          return;
        case 'upstreamChanged':
        case 'rejected':
        case 'cookieSecretMissing':
        case 'checkTokenUnavailable':
          await store.remove(key);
          break;
        default: {
          const unhandled: never = result.failure;
          throw new Error(`不认识的失败：${JSON.stringify(unhandled)}`);
        }
      }
    }
  };

  const send = (): void => {
    if (sending) {
      again = true;
      return;
    }
    const owner = account();
    if (owner === null) return;
    again = false;
    sending = locks
      .request(CHECK_IN_LOCK, () => sendAll(owner))
      .finally(() => {
        sending = null;
        if (again) send();
      });
  };

  return {
    send,
    sendBeforeLogout: (owner) =>
      locks.request(CHECK_IN_LOCK, async () => {
        for (const { checkIn } of await store.all()) {
          if (checkIn.owner === owner) await postCheckIn(api, checkIn);
        }
      }),
  };
};

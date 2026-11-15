import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';

import { endpoints } from '#lib/api/endpoints.ts';
import type { Api, Result } from '#lib/app/api-client.ts';
import { createLocalDatabase } from '#lib/app/local.ts';
import type { BackgroundLane } from '#lib/app/pacing.ts';
import type { Player, PlayerState } from '#lib/app/player.ts';
import { INITIAL_PLAYER } from '#lib/app/player.ts';
import type { SavedPlayerStore } from '#lib/app/saved-queue.ts';
import { createSavedQueue } from '#lib/app/saved-queue.ts';
import { createSessionRound } from '#lib/app/session-round.ts';

import { ANOTHER_ACCOUNT } from '../_kit/sign-in.ts';

const controlledApi = (): {
  api: Api;
  pending: Array<(result: Result<unknown>) => void>;
  calls: () => number;
} => {
  const pending: Array<(result: Result<unknown>) => void> = [];
  let calls = 0;
  const api = {
    get: (..._args: unknown[]) => {
      calls += 1;
      return new Promise<Result<unknown>>((resolve) => pending.push(resolve));
    },
    post: (..._args: unknown[]) => {
      throw new Error('这个测试只发 GET');
    },
  } as unknown as Api;
  return {
    api,
    pending,
    calls: () => calls,
  };
};

describe('会话一轮核心', () => {
  it('两个 needsLogin 同时回来：只过期一次、两个结果都丢掉', async () => {
    const { api, pending, calls } = controlledApi();
    let expired = 0;
    let stops = 0;
    const lane: BackgroundLane = {
      send: async () => null,
      stop: () => {
        stops += 1;
      },
      resume: () => {},
    };
    const round = createSessionRound({
      api,
      lane,
      expired: () => {
        expired += 1;
        void round.change({ kind: 'loginExpired' });
      },
    });
    await round.change({ kind: 'signedIn', account: ANOTHER_ACCOUNT });
    const before = round.current;

    const first = round.api.get(endpoints.account);
    const second = round.api.get(endpoints.account);
    expect(calls()).toBe(2);

    pending[0]({
      ok: false,
      failure: { kind: 'needsLogin' },
    });
    await vi.waitFor(() => expect(expired).toBe(1));
    // 先重新登录（新轮次）再放回旧请求，专门核对轮次令牌
    await round.change({ kind: 'signedIn', account: ANOTHER_ACCOUNT });
    pending[1]({
      ok: false,
      failure: { kind: 'needsLogin' },
    });

    await expect(first).resolves.toBeNull();
    await expect(second).resolves.toBeNull();
    expect(expired).toBe(1);
    expect(stops).toBe(1);
    expect(round.current).toBe(before + 2);
  });

  it('某个清理监听者抛错：其余清理照常跑、change 不 reject、记日志', async () => {
    const { api } = controlledApi();
    const lane: BackgroundLane = {
      send: async () => null,
      stop: () => {},
      resume: () => {},
    };
    const round = createSessionRound({
      api,
      lane,
      expired: () => {},
    });
    let cleared = 0;
    const logged: unknown[][] = [];
    const spy = vi
      .spyOn(console, 'error')
      .mockImplementation((...args: unknown[]) => {
        logged.push(args);
      });
    try {
      round.onChange(() => {
        throw new Error('清理失败');
      });
      round.onChange(() => {
        cleared += 1;
      });
      await expect(
        round.change({ kind: 'signedOut', by: 'other-tab' }),
      ).resolves.toBeUndefined();
      expect(cleared).toBe(1);
      expect(logged).toEqual([
        ['会话切换清理失败', 'signedOut', expect.any(Error)],
      ]);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('保存的播放队列核心', () => {
  it('别的标签页退出：停播不写最后一首，也不直接发', async () => {
    const { api } = controlledApi();
    let expiries = 0;
    let stopped = 0;
    let sent = 0;
    let queue!: SavedPlayerStore;
    const player = {
      stop: () => {
        stopped += 1;
        queue.forget([
          {
            songId: 1,
            source: { kind: 'downloads' },
            seconds: 10,
          },
        ]);
      },
      adopt: () => {},
      restore: () => {},
    } as unknown as Player;
    const lane: BackgroundLane = {
      send: async () => null,
      stop: () => {},
      resume: () => {},
    };
    const round = createSessionRound({
      api,
      lane,
      expired: () => {
        expiries += 1;
      },
    });
    queue = createSavedQueue({
      db: createLocalDatabase(new IDBFactory()),
      session: round,
      player: () => player,
      read: () => ({ ...INITIAL_PLAYER, current: null }) as PlayerState,
      send: () => {},
      sendBeforeLogout: async () => {
        sent += 1;
      },
    });

    await round.change({ kind: 'signedIn', account: ANOTHER_ACCOUNT });
    await round.change({ kind: 'signedOut', by: 'other-tab' });

    expect(stopped).toBe(1);
    expect(sent).toBe(0);
    expect(expiries).toBe(0);
    expect(await queue.pending.all()).toEqual([]);
  });
});

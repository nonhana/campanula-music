import type { Account } from '#lib/api/account.js';

import type { LocalDatabase } from './local';
import { CHECK_INS, PLAYER, settled as requestResult } from './local';
import type {
  CheckIn,
  Player,
  PlayerState,
  SavedPlayer,
  SavedProgress,
  SavedQueue,
} from './player';
import type { SessionRound } from './session-round';

interface StoredQueue extends SavedQueue {
  owner: number | null;
}

interface StoredPlayer {
  owner: number | null;
  saved: SavedPlayer;
}

export type PendingCheckIn = CheckIn & { owner: number };

export interface PendingCheckIns {
  all: () => Promise<{ key: number; checkIn: PendingCheckIn }[]>;
  remove: (key: number) => Promise<void>;
  clear: () => Promise<void>;
}

export interface SavedPlayerStore {
  // 进度、队列、打卡在同一个事务里存
  save: (
    progress: SavedProgress,
    queue: SavedQueue | undefined,
    checkIns: readonly CheckIn[],
  ) => void;
  forget: (checkIns: readonly CheckIn[]) => void;
  pending: PendingCheckIns;
}

interface PlayerStore {
  read: () => Promise<StoredPlayer | null>;
  save: (
    progress: SavedProgress,
    queue: StoredQueue | undefined,
    checkIns: readonly PendingCheckIn[],
  ) => Promise<void>;
  delete: (checkIns?: readonly PendingCheckIn[]) => Promise<void>;
  pending: () => Promise<{ key: number; checkIn: PendingCheckIn }[]>;
  deleteCheckIn: (key: number) => Promise<void>;
  clearCheckIns: () => Promise<void>;
}

export interface SavedQueueContext {
  db: LocalDatabase;
  session: SessionRound;
  player: () => Player;
  read: () => PlayerState;
  send: () => void;
  sendBeforeLogout: (owner: number) => Promise<void>;
}

const createPlayerStore = (db: LocalDatabase): PlayerStore => ({
  async read() {
    const store = (await db.open()).transaction(PLAYER).objectStore(PLAYER);
    const [queue, progress] = await Promise.all([
      requestResult(store.get('queue')) as Promise<StoredQueue | undefined>,
      requestResult(store.get('progress')) as Promise<
        SavedProgress | undefined
      >,
    ]);
    if (
      !queue ||
      !progress ||
      !queue.entries.some((entry) => entry.song.id === progress.songId)
    )
      return null;
    const { owner, ...saved } = queue;
    return {
      owner,
      saved: { queue: saved, progress },
    };
  },
  save: (progress, queue, checkIns) =>
    db.write(
      checkIns.length > 0 ? [PLAYER, CHECK_INS] : [PLAYER],
      (transaction) => {
        const store = transaction.objectStore(PLAYER);
        if (queue) store.put(queue, 'queue');
        store.put(progress, 'progress');
        for (const checkIn of checkIns)
          transaction.objectStore(CHECK_INS).add(checkIn);
      },
    ),
  delete: (checkIns = []) =>
    db.write(
      checkIns.length > 0 ? [PLAYER, CHECK_INS] : [PLAYER],
      (transaction) => {
        transaction.objectStore(PLAYER).clear();
        for (const checkIn of checkIns)
          transaction.objectStore(CHECK_INS).add(checkIn);
      },
    ),
  async pending() {
    const store = (await db.open())
      .transaction(CHECK_INS)
      .objectStore(CHECK_INS);
    const [keys, values] = await Promise.all([
      requestResult(store.getAllKeys()) as Promise<number[]>,
      requestResult(store.getAll()) as Promise<PendingCheckIn[]>,
    ]);
    return keys.map((key, index) => ({ key, checkIn: values[index] }));
  },
  deleteCheckIn: (key) =>
    db.write([CHECK_INS], (transaction) =>
      transaction.objectStore(CHECK_INS).delete(key),
    ),
  clearCheckIns: () =>
    db.write([CHECK_INS], (transaction) =>
      transaction.objectStore(CHECK_INS).clear(),
    ),
});

export const createSavedQueue = (
  context: SavedQueueContext,
): SavedPlayerStore => {
  const store = createPlayerStore(context.db);
  let owner: number | null = null;
  let leaving = false;
  let writes: Promise<unknown> = Promise.resolve();

  const chain = (action: () => Promise<void>): Promise<void> => {
    const next = writes.then(action);
    writes = next.catch(() => {});
    return next;
  };

  const tagged = (checkIns: readonly CheckIn[]): PendingCheckIn[] => {
    const current = owner;
    return current === null
      ? []
      : checkIns.map((checkIn) => ({ ...checkIn, owner: current }));
  };

  const stored = (queue: SavedQueue | undefined): StoredQueue | undefined =>
    queue && { ...queue, owner };

  const save = (
    progress: SavedProgress,
    queue: SavedQueue | undefined,
    checkIns: readonly CheckIn[],
  ): void => {
    const pending = tagged(checkIns);
    const taggedQueue = stored(queue);
    const work = chain(() => store.save(progress, taggedQueue, pending));
    if (!leaving && pending.length > 0)
      void work.then(
        () => context.send(),
        () => {},
      );
    else void work.catch(() => {});
  };

  const forget = (checkIns: readonly CheckIn[]): void => {
    const pending = tagged(checkIns);
    const work = chain(() => store.delete(pending));
    if (!leaving && pending.length > 0)
      void work.then(
        () => context.send(),
        () => {},
      );
    else void work.catch(() => {});
  };

  const enter = async (account: Account): Promise<void> => {
    const mine = context.session.current;
    leaving = false;
    const player = context.player();
    if (owner === null && context.read().current !== null) {
      owner = account.id;
      player.adopt();
      return;
    }
    if (owner === account.id) return;
    if (owner !== null) player.stop();
    owner = account.id;
    await writes;
    if (!context.session.isCurrent(mine)) return;
    const storedPlayer = await store.read();
    if (!context.session.isCurrent(mine)) return;
    if (storedPlayer?.owner === account.id) player.restore(storedPlayer.saved);
    else if (storedPlayer) await store.delete();
  };

  const restoreAnonymous = async (): Promise<void> => {
    const mine = context.session.current;
    leaving = false;
    await writes;
    if (!context.session.isCurrent(mine)) return;
    const storedPlayer = await store.read();
    if (!context.session.isCurrent(mine)) return;
    const player = context.player();
    if (storedPlayer?.owner === null && context.read().current === null)
      player.restore(storedPlayer.saved);
  };

  const leave = async (notify: boolean): Promise<void> => {
    const mine = context.session.current;
    leaving = true;
    const departed = owner;
    if (!notify) owner = null;
    context.player().stop();
    owner = null;
    await writes;
    // 退出还没做完就换了新一轮：新的会话接手，不再删它刚存下的队列
    if (!context.session.isCurrent(mine)) return;
    if (notify && departed !== null) await context.sendBeforeLogout(departed);
    if (!context.session.isCurrent(mine)) return;
    await chain(() => store.delete());
    leaving = false;
  };

  context.session.onChange((change) => {
    switch (change.kind) {
      case 'signedIn':
        return enter(change.account);
      case 'anonymous':
        return restoreAnonymous();
      case 'signedOut':
        return leave(change.by === 'this-tab');
      case 'loginExpired':
        leaving = false;
        break;
      default: {
        const unhandled: never = change;
        throw new Error(`不认识的会话变化：${JSON.stringify(unhandled)}`);
      }
    }
  });

  return {
    save,
    forget,
    pending: {
      async all() {
        await writes.catch(() => {});
        return store.pending();
      },
      remove: (key) => chain(() => store.deleteCheckIn(key)),
      clear: () => chain(() => store.clearCheckIns()),
    },
  };
};

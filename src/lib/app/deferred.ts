import { endpoints } from '#lib/api/endpoints.js';
import type { Playlist } from '#lib/api/library.js';
import {
  canSortPlaylist,
  reorderSortable,
  TRACKS_PER_CHANGE,
} from '#lib/api/library.js';
import type { WriteResponse } from '#lib/api/write.js';

import type { Clock, PageVisibility } from './browser';
import type { Change, ConfirmedChange, DeferredChange } from './changes';
import { targetOf } from './changes';
import type { ChangeFailure } from './library';
import type { LocalDb, Replica } from './local';
import type { Notices } from './notice';
import type { SessionResult, SessionRound } from './session-round';

const REMOVE_UNDO_MS = 5000;
const ORDER_MERGE_MS = 2000;

type RemoveChange = Extract<DeferredChange, { kind: 'remove' }>;
type OrderChange = Extract<DeferredChange, { kind: 'order' }>;
type PlaylistOrderChange = Extract<DeferredChange, { kind: 'playlistOrder' }>;
type Outcome = SessionResult<WriteResponse>;
type Answer = Exclude<Outcome, null>;

export interface PendingChange {
  change: ConfirmedChange;
  confirmedAt: number | null;
  saved: boolean;
}

interface Pending<C extends DeferredChange> {
  change: C;
  entry: PendingChange;
  sendingEntry: PendingChange | null;
  cancelTimer: () => void;
  sending: Promise<void> | null;
  settled: boolean;
  begin: () => void;
  finish: (mine: number) => void;
  failed: (mine: number, failure: ChangeFailure) => void;
}

interface PendingRemoval extends Pending<RemoveChange> {
  removalId: number;
}

interface Policy<C extends DeferredChange> {
  window: number;
  change: (item: Pending<C>) => C;
  settle: (
    mine: number,
    item: Pending<C>,
    entry: PendingChange,
    sent: C,
    result: Answer,
  ) => Promise<boolean>;
}

type Recovered = 'recovered' | 'missing' | 'failed' | 'stopped';

export interface DeferredContext {
  clock: Clock;
  page: PageVisibility;
  local: LocalDb;
  session: SessionRound;
  shown: () => Replica | null;
  replica: () => Replica | null;
  overlay: {
    add: (entry: PendingChange) => void;
    remove: (match: (change: ConfirmedChange) => boolean) => void;
    confirm: (
      mine: number,
      entry: PendingChange,
      change: Change,
    ) => Promise<boolean>;
  };
  publish: () => void;
  notices: Pick<Notices, 'show' | 'hideWhere'>;
  sync: () => void;
  online: () => boolean;
}

export interface Deferred {
  serialize: <T>(target: string, job: () => Promise<T>) => Promise<T>;
  settled: (target: string) => Promise<void>;
  remove: (playlist: Playlist, songIds: readonly number[]) => void;
  undoRemove: (removalId: number) => void;
  dismissRemoval: (removalId: number) => void;
  restore: (playlistId: number, songIds: readonly number[]) => Set<number>;
  retryRemove: (
    playlist: Playlist,
    songIds: readonly number[],
  ) => Promise<void>;
  moveSongs: (
    playlistId: number,
    songIds: readonly number[],
    before: number | null,
  ) => boolean;
  retryOrder: (playlist: Playlist, songIds: readonly number[]) => Promise<void>;
  orderPlaylists: (playlistIds: readonly number[]) => boolean;
  retryPlaylistOrder: (playlistIds: readonly number[]) => Promise<void>;
  flush: (playlistId?: number) => Promise<void>;
  recover: (
    mine: number,
    reload: (playlistId: number) => Promise<Recovered>,
  ) => Promise<void>;
  resume: (playlistIds: readonly number[]) => void;
  forget: () => void;
}

const sameOrder = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((id, index) => id === b[index]);

const entryOf = (change: Change): PendingChange => ({
  change,
  confirmedAt: null,
  saved: false,
});

const sortablePlaylists = (current: Replica): Playlist[] | null => {
  if (!current.playlists) return null;
  const sortable = current.playlists.filter((playlist) =>
    canSortPlaylist(playlist.kind),
  );
  return [
    ...sortable.filter((playlist) => playlist.kind === 'liked'),
    ...sortable.filter((playlist) => playlist.kind !== 'liked'),
  ];
};

const normalizedPlaylistOrder = (
  current: Replica,
  playlistIds: readonly number[],
): number[] => {
  const sortable = sortablePlaylists(current) ?? [];
  return reorderSortable(sortable, playlistIds, () => true).map(
    (playlist) => playlist.id,
  );
};

const orderProblem = (
  own: readonly Playlist[],
  playlistIds: readonly number[],
): string | null => {
  if (playlistIds.length !== own.length)
    return `自建歌单顺序不对：要 ${own.length} 张，给了 ${playlistIds.length} 张`;
  if (new Set(playlistIds).size !== playlistIds.length)
    return '自建歌单顺序里有重复的编号';
  const allowed = new Set(own.map((playlist) => playlist.id));
  const unknown = playlistIds.find((id) => !allowed.has(id));
  return unknown === undefined
    ? null
    : `自建歌单顺序里混进了不是自建歌单的编号：${unknown}`;
};

interface PendingState {
  removals: PendingRemoval[];
  noticeRemovalId: number | null;
  orders: Map<number, Pending<OrderChange>>;
  playlistOrder: Pending<PlaylistOrderChange> | null;
  recovering: Set<number>;
  writtenMarkers: Set<number>;
}

const freshPending = (): PendingState => ({
  removals: [],
  noticeRemovalId: null,
  orders: new Map(),
  playlistOrder: null,
  recovering: new Set(),
  writtenMarkers: new Set(),
});

export const createDeferred = (context: DeferredContext): Deferred => {
  const { clock, local, session } = context;
  let pending = freshPending();
  let nextRemovalId = 1;
  let markerSaving: Promise<void> = Promise.resolve();
  const queues = new Map<string, Promise<void>>();

  const resetPending = (): void => {
    for (const item of pending.removals) {
      item.settled = true;
      item.cancelTimer();
    }
    for (const item of pending.orders.values()) {
      item.settled = true;
      item.cancelTimer();
    }
    if (pending.playlistOrder) {
      pending.playlistOrder.settled = true;
      pending.playlistOrder.cancelTimer();
    }
    pending = freshPending();
  };

  const { show, hideWhere } = context.notices;

  const serialize = <T>(target: string, job: () => Promise<T>): Promise<T> => {
    const before = queues.get(target) ?? Promise.resolve();
    const run = before.then(job);
    const tail = run.then(
      () => {},
      () => {},
    );
    queues.set(target, tail);
    void tail.then(() => {
      if (queues.get(target) === tail) queues.delete(target);
    });
    return run;
  };

  const settled = async (target: string): Promise<void> => {
    let tail = queues.get(target);
    while (tail) {
      await tail;
      tail = queues.get(target);
    }
  };

  const saveMarkers = (mine: number): Promise<void> => {
    const current = context.replica();
    if (!current) return Promise.resolve();
    markerSaving = markerSaving
      .then(async () => {
        if (!session.isCurrent(mine) || !context.replica()) return;
        const active = new Set([
          ...pending.recovering,
          ...pending.removals.map((item) => item.change.playlist.id),
          ...pending.orders.keys(),
        ]);
        for (const id of active) {
          if (pending.writtenMarkers.has(id)) continue;
          await local.addPendingChange(current.owner, id);
          pending.writtenMarkers.add(id);
        }
        for (const id of [...pending.writtenMarkers]) {
          if (active.has(id)) continue;
          await local.removePendingChange(current.owner, id);
          pending.writtenMarkers.delete(id);
        }
      })
      .catch(() => {});
    return markerSaving;
  };

  const schedule = <C extends DeferredChange>(
    mine: number,
    item: Pending<C>,
    policy: Policy<C>,
  ): void => {
    item.cancelTimer();
    item.cancelTimer = clock.after(policy.window, () => {
      void commit(mine, item, policy, { keepalive: false });
    });
  };

  const commit = async <C extends DeferredChange>(
    mine: number,
    item: Pending<C>,
    policy: Policy<C>,
    {
      keepalive,
      immediate = false,
    }: { keepalive: boolean; immediate?: boolean },
  ): Promise<void> => {
    if (item.settled) return;
    if (item.sending) return item.sending;
    item.cancelTimer();
    item.begin();
    const target = targetOf(policy.change(item));
    const job = serialize(target, async () => {
      try {
        // 先等本机标记落盘，否则这时关掉页面就不知道要恢复
        await markerSaving;
        for (;;) {
          if (item.settled || !session.isCurrent(mine)) return;
          const entry = item.entry;
          const sent = policy.change(item);
          item.sendingEntry = entry;
          const result = await submit(mine, sent, keepalive);
          if (!result || item.settled || !session.isCurrent(mine)) return;
          if (!(await policy.settle(mine, item, entry, sent, result))) return;
          if (item.settled || !session.isCurrent(mine)) return;
          if (immediate) continue;
          schedule(mine, item, policy);
          return;
        }
      } catch {
        if (!item.settled && session.isCurrent(mine))
          item.failed(mine, { kind: 'serverError' });
      }
    });
    item.sending = job.finally(() => {
      item.sending = null;
    });
    return item.sending;
  };

  const submit = (
    mine: number,
    change: RemoveChange | OrderChange | PlaylistOrderChange,
    keepalive: boolean,
  ): Promise<Outcome> => {
    if (!session.isCurrent(mine)) return Promise.resolve(null);
    const options = keepalive ? { keepalive: true } : undefined;
    switch (change.kind) {
      case 'remove':
        return session.api.post(
          endpoints.removeTracks,
          { id: change.playlist.id },
          { songIds: change.songIds },
          options,
        );
      case 'order':
        return session.api.post(
          endpoints.songOrder,
          { id: change.playlist.id },
          { songIds: change.songIds },
          options,
        );
      case 'playlistOrder':
        return session.api.post(
          endpoints.playlistOrder,
          { playlistIds: change.playlistIds },
          options,
        );
    }
  };

  const accepted = async <C extends DeferredChange>(
    mine: number,
    item: Pending<C>,
    entry: PendingChange,
    sent: C,
  ): Promise<boolean> => {
    if (!(await context.overlay.confirm(mine, entry, sent))) return false;
    item.sendingEntry = null;
    if (item.entry === entry) {
      item.finish(mine);
      context.publish();
      return false;
    }
    return true;
  };

  const orderLanded = async (
    playlistId: number,
    songIds: readonly number[],
  ): Promise<boolean> => {
    const result = await session.api.get(endpoints.trackIds, {
      id: playlistId,
    });
    if (!result?.ok) return false;
    // 只比两边都有的歌的先后；一首都没有对上不算成功
    const upstream = new Set(result.value.trackIds);
    const submitted = new Set(songIds);
    const common = result.value.trackIds.filter((id) => submitted.has(id));
    const expected = songIds.filter((id) => upstream.has(id));
    return common.length > 0 && sameOrder(expected, common);
  };

  const orderFailed = (
    mine: number,
    item: Pending<OrderChange>,
    failure: ChangeFailure | null,
  ): void => {
    if (!session.isCurrent(mine)) return;
    const { playlist, songIds } = item.change;
    context.overlay.remove(
      (change) => change.kind === 'order' && change.playlist.id === playlist.id,
    );
    item.finish(mine);
    show({
      kind: 'orderFailed',
      playlist,
      songIds: [...songIds],
      failure,
    });
  };

  const orderMissing = (
    mine: number,
    item: Pending<OrderChange>,
    sent: OrderChange,
  ): void => {
    if (!session.isCurrent(mine)) return;
    context.overlay.remove(
      (change) =>
        change.kind === 'order' && change.playlist.id === sent.playlist.id,
    );
    item.finish(mine);
    show({ kind: 'playlistMissing', change: sent });
    context.sync();
  };

  const playlistOrderFailed = (
    mine: number,
    item: Pending<PlaylistOrderChange>,
    failure: ChangeFailure,
  ): void => {
    if (!session.isCurrent(mine)) return;
    const playlistIds = [...item.change.playlistIds];
    context.overlay.remove((change) => change.kind === 'playlistOrder');
    item.finish(mine);
    show({ kind: 'playlistOrderFailed', playlistIds, failure });
  };

  const removalPolicy: Policy<RemoveChange> = {
    window: REMOVE_UNDO_MS,
    change: (item) => item.change,
    async settle(mine, item, entry, sent, result) {
      if (result.ok && result.value.kind === 'done')
        return accepted(mine, item, entry, sent);
      context.overlay.remove((change) => change === entry.change);
      item.finish(mine);
      if (result.ok && result.value.kind === 'missing') {
        show({ kind: 'playlistMissing', change: sent });
        context.sync();
        return false;
      }
      // unconfirmed 只有整张歌单排序会回，移除遇到它按没成功处理
      const failure: ChangeFailure = result.ok
        ? { kind: 'neteaseUnavailable' }
        : result.failure;
      show({
        kind: 'removeFailed',
        playlist: sent.playlist,
        count: sent.songIds.length,
        songIds: [...sent.songIds],
        failure,
      });
      return false;
    },
  };

  const orderPolicy: Policy<OrderChange> = {
    window: ORDER_MERGE_MS,
    change: (item) => item.change,
    async settle(mine, item, entry, sent, result) {
      if (result.ok && result.value.kind === 'done')
        return accepted(mine, item, entry, sent);
      if (result.ok && result.value.kind === 'unconfirmed') {
        if (await orderLanded(sent.playlist.id, sent.songIds))
          return accepted(mine, item, entry, sent);
        orderFailed(mine, item, null);
        return false;
      }
      if (!result.ok && result.failure.kind === 'neteaseUnavailable') {
        if (await orderLanded(sent.playlist.id, sent.songIds))
          return accepted(mine, item, entry, sent);
        orderFailed(mine, item, result.failure);
        return false;
      }
      if (result.ok) {
        orderMissing(mine, item, sent);
        return false;
      }
      orderFailed(mine, item, result.failure);
      return false;
    },
  };

  const playlistOrderPolicy: Policy<PlaylistOrderChange> = {
    window: ORDER_MERGE_MS,
    change: (item) => item.change,
    async settle(mine, item, entry, sent, result) {
      if (result.ok) return accepted(mine, item, entry, sent);
      playlistOrderFailed(mine, item, result.failure);
      return false;
    },
  };

  const startRemoval = (
    mine: number,
    playlist: Playlist,
    songIds: readonly number[],
  ): PendingRemoval => {
    const change: RemoveChange = {
      kind: 'remove',
      playlist,
      songIds: [...songIds],
    };
    const entry = entryOf(change);
    const removalId = nextRemovalId++;
    const item: PendingRemoval = {
      change,
      entry,
      removalId,
      sendingEntry: null,
      cancelTimer: () => {},
      sending: null,
      settled: false,
      begin: () => {
        if (pending.noticeRemovalId === item.removalId)
          pending.noticeRemovalId = null;
        hideWhere(
          (notice) =>
            notice.kind === 'removed' && notice.removalId === item.removalId,
        );
      },
      finish: (mine) => {
        item.settled = true;
        item.cancelTimer();
        pending.removals = pending.removals.filter((each) => each !== item);
        if (pending.noticeRemovalId === item.removalId)
          pending.noticeRemovalId = null;
        void saveMarkers(mine);
      },
      failed: (mine, failure) => {
        if (item.settled || !session.isCurrent(mine)) return;
        context.overlay.remove((change) => change === item.entry.change);
        item.finish(mine);
        const { playlist, songIds } = item.change;
        show({
          kind: 'removeFailed',
          playlist,
          count: songIds.length,
          songIds: [...songIds],
          failure,
        });
      },
    };
    context.overlay.add(entry);
    pending.removals.push(item);
    pending.noticeRemovalId = removalId;
    void saveMarkers(mine);
    return item;
  };

  const applyRemoval = (
    mine: number,
    playlist: Playlist,
    songIds: readonly number[],
    { undo }: { undo: boolean },
  ): PendingRemoval => {
    if (undo) {
      const previousId = pending.noticeRemovalId;
      const previous =
        previousId === null
          ? undefined
          : pending.removals.find(
              (each) =>
                each.removalId === previousId && !each.settled && !each.sending,
            );
      if (previous?.change.playlist.id === playlist.id) {
        const combined = [...new Set([...previous.change.songIds, ...songIds])];
        previous.change.songIds = combined;
        schedule(mine, previous, removalPolicy);
        hideWhere(
          (notice) =>
            notice.kind === 'removed' &&
            notice.removalId === previous.removalId,
        );
        show({
          kind: 'removed',
          playlist,
          count: combined.length,
          removalId: previous.removalId,
        });
        return previous;
      }
    }
    const item = startRemoval(mine, playlist, songIds);
    if (undo) {
      show({
        kind: 'removed',
        playlist,
        count: songIds.length,
        removalId: item.removalId,
      });
      schedule(mine, item, removalPolicy);
    } else {
      hideWhere(
        (notice) =>
          notice.kind === 'removeFailed' && notice.playlist.id === playlist.id,
      );
    }
    return item;
  };

  const remove = (playlist: Playlist, songIds: readonly number[]): void => {
    const current = context.replica();
    if (!current) return;
    const tracks = current.tracks.get(playlist.id);
    const present = new Set(tracks?.trackIds ?? []);
    const ids = [...new Set(songIds)].filter((id) => present.has(id));
    if (ids.length === 0) return;
    const mine = session.current;
    if (ids.length > TRACKS_PER_CHANGE) {
      show({
        kind: 'removeFailed',
        playlist,
        count: ids.length,
        songIds: ids,
        failure: { kind: 'invalid', problem: 'tooManySongs' },
      });
      return;
    }
    if (!context.online()) {
      show({
        kind: 'removeFailed',
        playlist,
        count: ids.length,
        songIds: ids,
        failure: { kind: 'offline' },
      });
      return;
    }
    applyRemoval(mine, playlist, ids, { undo: true });
  };

  const undoRemove = (removalId: number): void => {
    const item = pending.removals.find(
      (each) => each.removalId === removalId && !each.settled && !each.sending,
    );
    if (!item) return;
    item.settled = true;
    item.cancelTimer();
    context.overlay.remove((change) => change === item.entry.change);
    pending.removals = pending.removals.filter((each) => each !== item);
    if (pending.noticeRemovalId === removalId) pending.noticeRemovalId = null;
    hideWhere(
      (notice) => notice.kind === 'removed' && notice.removalId === removalId,
    );
    context.publish();
    void saveMarkers(session.current);
  };

  const dismissRemoval = (removalId: number): void => {
    if (pending.noticeRemovalId === removalId) pending.noticeRemovalId = null;
  };

  const restore = (
    playlistId: number,
    songIds: readonly number[],
  ): Set<number> => {
    const ids = new Set(songIds);
    const restored = new Set<number>();
    for (const item of [...pending.removals]) {
      if (item.change.playlist.id !== playlistId || item.sending) continue;
      const overlap = item.change.songIds.filter((id) => ids.has(id));
      if (overlap.length === 0) continue;
      for (const id of overlap) restored.add(id);
      const remaining = item.change.songIds.filter((id) => !ids.has(id));
      if (remaining.length === 0) {
        item.settled = true;
        item.cancelTimer();
        context.overlay.remove((change) => change === item.entry.change);
        pending.removals = pending.removals.filter((each) => each !== item);
        if (pending.noticeRemovalId === item.removalId)
          pending.noticeRemovalId = null;
      } else {
        item.change.songIds = remaining;
      }
      const hadNotice = hideWhere(
        (notice) =>
          notice.kind === 'removed' && notice.removalId === item.removalId,
      );
      if (hadNotice && remaining.length > 0) {
        show({
          kind: 'removed',
          playlist: item.change.playlist,
          count: remaining.length,
          removalId: item.removalId,
        });
      }
    }
    if (restored.size > 0) {
      const playlist = context
        .replica()
        ?.playlists?.find((each) => each.id === playlistId);
      if (playlist) show({ kind: 'alreadyAdded', playlist });
      void saveMarkers(session.current);
    }
    return restored;
  };

  const retryRemove = async (
    playlist: Playlist,
    songIds: readonly number[],
  ): Promise<void> => {
    const fresh = context
      .replica()
      ?.playlists?.find((item) => item.id === playlist.id);
    if (!fresh) return;
    if (!context.online()) {
      show({
        kind: 'removeFailed',
        playlist: fresh,
        count: songIds.length,
        songIds: [...songIds],
        failure: { kind: 'offline' },
      });
      return;
    }
    const mine = session.current;
    const item = applyRemoval(mine, fresh, songIds, { undo: false });
    await commit(mine, item, removalPolicy, { keepalive: false });
  };

  const startOrder = (
    mine: number,
    playlist: Playlist,
    songIds: readonly number[],
  ): Pending<OrderChange> => {
    const change: OrderChange = {
      kind: 'order',
      playlist,
      songIds: [...songIds],
    };
    const entry = entryOf(change);
    const item: Pending<OrderChange> = {
      change,
      entry,
      sendingEntry: null,
      cancelTimer: () => {},
      sending: null,
      settled: false,
      begin: () => {
        hideWhere(
          (notice) =>
            notice.kind === 'orderFailed' && notice.playlist.id === playlist.id,
        );
      },
      finish: (mine) => {
        item.settled = true;
        item.cancelTimer();
        item.sendingEntry = null;
        pending.orders.delete(item.change.playlist.id);
        void saveMarkers(mine);
      },
      failed: (mine, failure) => {
        orderFailed(mine, item, failure);
      },
    };
    pending.orders.set(playlist.id, item);
    context.overlay.add(entry);
    schedule(mine, item, orderPolicy);
    return item;
  };

  const mergePending = <C extends DeferredChange>(
    item: Pending<C>,
    change: C,
    mine: number,
    policy: Policy<C>,
  ): void => {
    item.change = change;
    if (item.sending) {
      if (item.entry === item.sendingEntry) {
        item.entry = entryOf(change);
        context.overlay.add(item.entry);
      } else {
        item.entry.change = change;
      }
      return;
    }
    item.entry.change = change;
    schedule(mine, item, policy);
  };

  const moveSongs = (
    playlistId: number,
    songIds: readonly number[],
    before: number | null,
  ): boolean => {
    const current = context.replica();
    const display = context.shown();
    if (!current || !display) return false;
    const playlist = current.playlists?.find((item) => item.id === playlistId);
    if (!playlist || !canSortPlaylist(playlist.kind)) return false;
    const tracks = display.tracks.get(playlistId);
    if (!tracks) return false;
    const moved = new Set(songIds);
    const moving = tracks.trackIds.filter((id) => moved.has(id));
    if (moving.length === 0) return false;
    const rest = tracks.trackIds.filter((id) => !moved.has(id));
    const at = before === null ? rest.length : rest.indexOf(before);
    if (at < 0) return false;
    const next = [...rest.slice(0, at), ...moving, ...rest.slice(at)];
    if (sameOrder(next, tracks.trackIds)) return false;
    if (!context.online()) {
      show({
        kind: 'orderFailed',
        playlist,
        songIds: next,
        failure: { kind: 'offline' },
      });
      return false;
    }
    const mine = session.current;
    const item = pending.orders.get(playlistId);
    if (item && !item.settled)
      mergePending(
        item,
        { kind: 'order', playlist, songIds: next },
        mine,
        orderPolicy,
      );
    else startOrder(mine, playlist, next);
    hideWhere(
      (notice) =>
        notice.kind === 'orderFailed' && notice.playlist.id === playlistId,
    );
    context.publish();
    void saveMarkers(mine);
    return true;
  };

  const orderPlaylists = (playlistIds: readonly number[]): boolean => {
    const current = context.replica();
    const display = context.shown();
    if (!current || !display?.playlists) return false;
    const own = display.playlists.filter((playlist) => playlist.kind === 'own');
    const problem = orderProblem(own, playlistIds);
    if (problem) throw new Error(problem);
    const liked = display.playlists.find(
      (playlist) => playlist.kind === 'liked',
    );
    const next = liked ? [liked.id, ...playlistIds] : [...playlistIds];
    const displayed = sortablePlaylists(display);
    if (
      displayed &&
      sameOrder(
        next,
        displayed.map((playlist) => playlist.id),
      )
    )
      return false;
    const mine = session.current;
    const item = pending.playlistOrder;
    const base = sortablePlaylists(current);
    if (
      base &&
      sameOrder(
        next,
        base.map((playlist) => playlist.id),
      )
    ) {
      if (!item || item.settled) return false;
      if (!item.sending) {
        context.overlay.remove((change) => change === item.entry.change);
        item.finish(mine);
        hideWhere((notice) => notice.kind === 'playlistOrderFailed');
        context.publish();
        return true;
      }
    }
    if (!context.online()) {
      show({
        kind: 'playlistOrderFailed',
        playlistIds: next,
        failure: { kind: 'offline' },
      });
      return false;
    }
    if (item && !item.settled)
      mergePending(
        item,
        { kind: 'playlistOrder', playlistIds: next },
        mine,
        playlistOrderPolicy,
      );
    else startPlaylistOrder(mine, next);
    hideWhere((notice) => notice.kind === 'playlistOrderFailed');
    context.publish();
    return true;
  };

  const startPlaylistOrder = (
    mine: number,
    playlistIds: readonly number[],
  ): Pending<PlaylistOrderChange> => {
    const change: PlaylistOrderChange = {
      kind: 'playlistOrder',
      playlistIds: [...playlistIds],
    };
    const entry = entryOf(change);
    const item: Pending<PlaylistOrderChange> = {
      change,
      entry,
      sendingEntry: null,
      cancelTimer: () => {},
      sending: null,
      settled: false,
      begin: () => {
        hideWhere((notice) => notice.kind === 'playlistOrderFailed');
      },
      finish: (mine) => {
        item.settled = true;
        item.cancelTimer();
        item.sendingEntry = null;
        if (pending.playlistOrder === item) pending.playlistOrder = null;
        void saveMarkers(mine);
      },
      failed: (mine, failure) => {
        playlistOrderFailed(mine, item, failure);
      },
    };
    pending.playlistOrder = item;
    context.overlay.add(entry);
    schedule(mine, item, playlistOrderPolicy);
    return item;
  };

  const retryOrder = async (
    playlist: Playlist,
    songIds: readonly number[],
  ): Promise<void> => {
    const current = context.replica();
    if (!current) return;
    const found = current.playlists?.find((item) => item.id === playlist.id);
    if (!found) return;
    if (!context.online()) {
      show({
        kind: 'orderFailed',
        playlist: found,
        songIds,
        failure: { kind: 'offline' },
      });
      return;
    }
    const mine = session.current;
    const item = startOrder(mine, found, songIds);
    hideWhere(
      (notice) =>
        notice.kind === 'orderFailed' && notice.playlist.id === found.id,
    );
    context.publish();
    void saveMarkers(mine);
    await commit(mine, item, orderPolicy, {
      keepalive: false,
      immediate: true,
    });
  };

  const retryPlaylistOrder = async (
    playlistIds: readonly number[],
  ): Promise<void> => {
    const current = context.replica();
    if (!current) return;
    if (!context.online()) {
      show({
        kind: 'playlistOrderFailed',
        playlistIds,
        failure: { kind: 'offline' },
      });
      return;
    }
    const mine = session.current;
    const item = startPlaylistOrder(
      mine,
      normalizedPlaylistOrder(current, playlistIds),
    );
    hideWhere((notice) => notice.kind === 'playlistOrderFailed');
    context.publish();
    await commit(mine, item, playlistOrderPolicy, {
      keepalive: false,
      immediate: true,
    });
  };

  const flush = async (playlistId?: number): Promise<void> => {
    const mine = session.current;
    await Promise.all([
      ...pending.removals
        .filter(
          (item) =>
            playlistId === undefined || item.change.playlist.id === playlistId,
        )
        .map((item) => commit(mine, item, removalPolicy, { keepalive: true })),
      ...[...pending.orders.values()]
        .filter(
          (item) =>
            playlistId === undefined || item.change.playlist.id === playlistId,
        )
        .map((item) =>
          commit(mine, item, orderPolicy, { keepalive: true, immediate: true }),
        ),
      ...(playlistId === undefined && pending.playlistOrder
        ? [
            commit(mine, pending.playlistOrder, playlistOrderPolicy, {
              keepalive: true,
              immediate: true,
            }),
          ]
        : []),
    ]);
  };

  const recover = async (
    mine: number,
    reload: (playlistId: number) => Promise<Recovered>,
  ): Promise<void> => {
    if (pending.recovering.size === 0) return;
    let recovered = false;
    for (const id of [...pending.recovering]) {
      if (!session.isCurrent(mine)) return;
      const result = await reload(id);
      if (result === 'stopped') return;
      if (result === 'failed') continue;
      pending.recovering.delete(id);
      recovered = true;
    }
    if (recovered && session.isCurrent(mine)) show({ kind: 'recovered' });
    await saveMarkers(mine);
  };

  const resume = (playlistIds: readonly number[]): void => {
    pending.recovering = new Set(playlistIds);
    pending.writtenMarkers = new Set(pending.recovering);
  };

  const forget = (): void => {
    resetPending();
    queues.clear();
  };

  context.page.addEventListener('visibilitychange', () => {
    if (context.page.visibilityState === 'hidden') void flush();
  });

  return {
    serialize,
    settled,
    remove,
    undoRemove,
    dismissRemoval,
    restore,
    retryRemove,
    moveSongs,
    retryOrder,
    orderPlaylists,
    retryPlaylistOrder,
    flush,
    recover,
    resume,
    forget,
  };
};

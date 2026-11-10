import type { Playlist, Song } from '#lib/api/library.js';

import type { Clock } from './browser';
import type { Change } from './changes';
import type { DownloadNotice } from './downloads';
import type { ChangeFailure, SyncFailure } from './library';

export type NoticeAction = 'undo' | 'retry' | 'dismiss' | 'resume';

export type NoticeTone = 'success' | 'error';

export type OperationNotice =
  | { kind: 'notChanged'; change: Change; failure: ChangeFailure }
  | {
      kind: 'playlistMissing';
      change: Extract<
        Change,
        { kind: 'add' | 'addMany' | 'remove' | 'order' | 'collectPlaylist' }
      >;
    }
  | { kind: 'added'; change: Extract<Change, { kind: 'add' | 'addMany' }> }
  | { kind: 'alreadyAdded'; playlist: Playlist }
  | { kind: 'removed'; playlist: Playlist; count: number; removalId: number }
  | {
      kind: 'removeFailed';
      playlist: Playlist;
      count: number;
      songIds: readonly number[];
      failure: ChangeFailure;
    }
  // failure 是 null：网易云回 -1、重读也不是新顺序，说不出原因
  | {
      kind: 'orderFailed';
      playlist: Playlist;
      songIds: readonly number[];
      failure: ChangeFailure | null;
    }
  | {
      kind: 'playlistOrderFailed';
      playlistIds: readonly number[];
      failure: ChangeFailure;
    }
  | { kind: 'recovered' }
  | { kind: 'syncFailed'; failure: SyncFailure }
  | { kind: 'queuedNext'; count: number; started: boolean }
  | { kind: 'queuedEnd'; count: number; started: boolean }
  | { kind: 'hearted'; song: Song; hearted: boolean }
  | { kind: 'playlistCreated'; name: string }
  | { kind: 'playlistPublished'; name: string }
  | { kind: 'playlistDeleted'; name: string }
  | { kind: 'plain'; tone: NoticeTone; text: string }
  | DownloadNotice;

export interface NoticeEntry {
  id: number;
  notice: OperationNotice;
  actions: readonly NoticeAction[];
  tone: NoticeTone;
}

export interface ShowNoticeOptions {
  key?: string;
}

const AUTO_DISMISS_MS = 4000;
const MERGE_WINDOW_MS = 2000;
const MAX_ENTRIES = 3;

const noticeActions = (notice: OperationNotice): readonly NoticeAction[] => {
  switch (notice.kind) {
    case 'removed':
      return ['undo', 'dismiss'];
    case 'removeFailed':
      return notice.failure.kind === 'invalid' &&
        notice.failure.problem === 'tooManySongs'
        ? ['dismiss']
        : ['retry', 'dismiss'];
    case 'orderFailed':
    case 'playlistOrderFailed':
    case 'syncFailed':
      return ['retry', 'dismiss'];
    case 'downloadFailed':
      return (notice.count ?? 1) > 1 ? ['dismiss'] : ['retry', 'dismiss'];
    case 'downloadsPaused':
      return ['resume', 'dismiss'];
    case 'downloadsRemoved':
      return ['dismiss'];
    case 'notChanged':
    case 'playlistMissing':
    case 'added':
    case 'alreadyAdded':
    case 'downloadsSkipped':
    case 'recovered':
    case 'queuedNext':
    case 'queuedEnd':
    case 'hearted':
    case 'playlistCreated':
    case 'playlistPublished':
    case 'playlistDeleted':
    case 'plain':
      return ['dismiss'];
    default: {
      const unhandled: never = notice;
      throw new Error(`不认识的提示：${JSON.stringify(unhandled)}`);
    }
  }
};

const noticeLifetime = (notice: OperationNotice): number | null => {
  switch (notice.kind) {
    case 'added':
    case 'alreadyAdded':
    case 'downloadsSkipped':
    case 'downloadsRemoved':
    case 'queuedNext':
    case 'queuedEnd':
    case 'hearted':
    case 'playlistCreated':
    case 'playlistPublished':
    case 'playlistDeleted':
      return AUTO_DISMISS_MS;
    case 'plain':
      return notice.tone === 'success' ? AUTO_DISMISS_MS : null;
    case 'notChanged':
    case 'playlistMissing':
    case 'removed':
    case 'removeFailed':
    case 'orderFailed':
    case 'playlistOrderFailed':
    case 'recovered':
    case 'downloadFailed':
    case 'syncFailed':
    case 'downloadsPaused':
      return null;
    default: {
      const unhandled: never = notice;
      throw new Error(`不认识的提示：${JSON.stringify(unhandled)}`);
    }
  }
};

const noticeTone = (notice: OperationNotice): NoticeTone => {
  switch (notice.kind) {
    case 'added':
    case 'alreadyAdded':
    case 'removed':
    case 'downloadsSkipped':
    case 'downloadsRemoved':
    case 'queuedNext':
    case 'queuedEnd':
    case 'hearted':
    case 'playlistCreated':
    case 'playlistPublished':
    case 'playlistDeleted':
      return 'success';
    case 'notChanged':
    case 'playlistMissing':
    case 'removeFailed':
    case 'orderFailed':
    case 'playlistOrderFailed':
    case 'recovered':
    case 'syncFailed':
    case 'downloadFailed':
    case 'downloadsPaused':
      return 'error';
    case 'plain':
      return notice.tone;
    default: {
      const unhandled: never = notice;
      throw new Error(`不认识的提示：${JSON.stringify(unhandled)}`);
    }
  }
};

const defaultKey = (notice: OperationNotice): string | null => {
  switch (notice.kind) {
    case 'queuedNext':
      return 'queued-next';
    case 'queuedEnd':
      return 'queued-end';
    case 'downloadFailed':
      return 'download-failed';
    case 'downloadsRemoved':
      return 'downloads-removed';
    default:
      return null;
  }
};

const mergeNotice = (
  previous: OperationNotice,
  next: OperationNotice,
): OperationNotice => {
  switch (next.kind) {
    case 'queuedNext':
      return previous.kind === 'queuedNext'
        ? {
            ...next,
            count: previous.count + next.count,
            started: previous.started,
          }
        : next;
    case 'queuedEnd':
      return previous.kind === 'queuedEnd'
        ? {
            ...next,
            count: previous.count + next.count,
            started: previous.started,
          }
        : next;
    case 'downloadFailed':
      return previous.kind === 'downloadFailed'
        ? { ...next, count: (previous.count ?? 1) + (next.count ?? 1) }
        : next;
    case 'downloadsRemoved':
      return previous.kind === 'downloadsRemoved'
        ? {
            kind: 'downloadsRemoved',
            removed: previous.removed + next.removed,
            kept: previous.kept + next.kept,
          }
        : next;
    default:
      return next;
  }
};

export interface NoticesContext {
  clock: Clock;
  changed: () => void;
}

export interface Notices {
  list: () => readonly NoticeEntry[];
  show: (notice: OperationNotice, options?: ShowNoticeOptions) => number;
  hide: (id: number) => void;
  hideWhere: (match: (notice: OperationNotice) => boolean) => boolean;
  clear: () => void;
}

interface Tracked {
  entry: NoticeEntry;
  key: string | null;
  at: number;
  cancel: () => void;
}

export const createNotices = ({ clock, changed }: NoticesContext): Notices => {
  let entries: Tracked[] = [];
  let nextId = 1;

  const drop = (tracked: Tracked): void => {
    tracked.cancel();
    entries = entries.filter((each) => each !== tracked);
  };

  const schedule = (tracked: Tracked): void => {
    const lifetime = noticeLifetime(tracked.entry.notice);
    if (lifetime === null) return;
    tracked.cancel = clock.after(lifetime, () => {
      tracked.cancel = () => {};
      if (!entries.includes(tracked)) return;
      drop(tracked);
      changed();
    });
  };

  const mergeInto = (tracked: Tracked, notice: OperationNotice): void => {
    tracked.cancel();
    tracked.entry = {
      id: tracked.entry.id,
      notice,
      actions: noticeActions(notice),
      tone: noticeTone(notice),
    };
    tracked.at = clock.now();
    schedule(tracked);
  };

  const show = (
    notice: OperationNotice,
    options: ShowNoticeOptions = {},
  ): number => {
    const key = options.key ?? defaultKey(notice);
    if (key !== null) {
      const found = entries.find(
        (tracked) =>
          tracked.key === key && clock.now() - tracked.at <= MERGE_WINDOW_MS,
      );
      if (found) {
        mergeInto(found, mergeNotice(found.entry.notice, notice));
        changed();
        return found.entry.id;
      }
    }
    while (entries.length >= MAX_ENTRIES) {
      const at = entries.findIndex(
        (tracked) => noticeLifetime(tracked.entry.notice) !== null,
      );
      const oldest = entries[at >= 0 ? at : 0];
      if (!oldest) break;
      drop(oldest);
    }
    const entry: NoticeEntry = {
      id: nextId++,
      notice,
      actions: noticeActions(notice),
      tone: noticeTone(notice),
    };
    const tracked: Tracked = {
      entry,
      key,
      at: clock.now(),
      cancel: () => {},
    };
    entries = [...entries, tracked];
    schedule(tracked);
    changed();
    return entry.id;
  };

  const hide = (id: number): void => {
    const tracked = entries.find((each) => each.entry.id === id);
    if (!tracked) return;
    drop(tracked);
    changed();
  };

  const hideWhere = (match: (notice: OperationNotice) => boolean): boolean => {
    const matched = entries.filter((tracked) => match(tracked.entry.notice));
    if (matched.length === 0) return false;
    for (const tracked of matched) drop(tracked);
    changed();
    return true;
  };

  const clear = (): void => {
    if (entries.length === 0) return;
    for (const tracked of entries) tracked.cancel();
    entries = [];
    changed();
  };

  return {
    list: () => entries.map((tracked) => tracked.entry),
    show,
    hide,
    hideWhere,
    clear,
  };
};

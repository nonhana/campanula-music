import type { Song } from '#lib/api/library.js';

import type { AppView } from '../shared/app-context.svelte';

// 能不能放的规则只在 App 里推一次，这里只读 state.playable

export type DownloadMark =
  | { kind: 'done' }
  | { kind: 'queued' }
  | { kind: 'downloading'; percent: number | null }
  | { kind: 'failed' };

export type SongBadgeKind = 'noCopyright' | 'notDownloaded' | 'trial';

export interface SongLook {
  off: boolean;
  badge: SongBadgeKind | null;
  mark: DownloadMark | null;
}

export const songLook = (view: AppView, song: Song): SongLook => {
  const { downloads } = view.state;
  const downloaded = downloads.has(song.id);
  const task = downloads.tasks.get(song.id);
  const mark: DownloadMark | null = downloaded
    ? { kind: 'done' }
    : task?.status === 'downloading'
      ? {
          kind: 'downloading',
          percent: task.total
            ? Math.floor((task.received * 100) / task.total)
            : null,
        }
      : task?.status === 'queued'
        ? { kind: 'queued' }
        : task?.status === 'failed'
          ? { kind: 'failed' }
          : null;
  const off = !view.state.playable(song);
  const badge: SongBadgeKind | null = downloaded
    ? null
    : song.availability === 'noCopyright'
      ? 'noCopyright'
      : off
        ? 'notDownloaded'
        : song.availability === 'trial'
          ? 'trial'
          : null;
  return { off, badge, mark };
};

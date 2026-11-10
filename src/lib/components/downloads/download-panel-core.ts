import type { DownloadTask } from '#lib/app/downloads.js';

export const PANEL_TASK_LIMIT = 50;
export const LEAVING_HOLD_MS = 240;

export interface LeavingTask {
  songId: number;
  content: DownloadTask;
  phase: 'run' | 'exit';
}

export type PanelRow =
  | { kind: 'leaving'; key: string; leaving: LeavingTask }
  | { kind: 'task'; key: string; task: DownloadTask };

export const panelRows = (
  tasks: readonly DownloadTask[],
  leaving: readonly LeavingTask[],
): PanelRow[] => [
  ...leaving.map((item) => ({
    kind: 'leaving' as const,
    key: `task-${item.songId}`,
    leaving: item,
  })),
  ...tasks
    .filter((task) => !leaving.some((item) => item.songId === task.song.id))
    .map((task) => ({
      kind: 'task' as const,
      key: `task-${task.song.id}`,
      task,
    })),
];

export const leavingOf = (task: DownloadTask): LeavingTask => ({
  songId: task.song.id,
  content: task,
  phase: 'run',
});

const RANK: Record<DownloadTask['status'], number> = {
  downloading: 0,
  failed: 1,
  queued: 2,
};
const rank = (task: DownloadTask): number => RANK[task.status];

export const visiblePanelTasks = (
  tasks: readonly DownloadTask[],
  limit = PANEL_TASK_LIMIT,
): DownloadTask[] =>
  tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => rank(a.task) - rank(b.task) || a.index - b.index)
    .slice(0, limit)
    .map(({ task }) => task);

export const panelOpensOn = (previous: number, next: number): boolean =>
  previous === 0 && next > 0;

export const completedSince = (
  previous: readonly number[],
  next: readonly number[],
  has: (songId: number) => boolean,
): number[] => {
  const remaining = new Set(next);
  return previous.filter((songId) => !remaining.has(songId) && has(songId));
};

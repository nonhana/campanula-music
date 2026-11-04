import type { DownloadTask } from '#lib/app/downloads.js'

// 下载面板（#38）：哪些行先显示、什么时候该出来。只算，不碰 DOM 和计时。

/** 面板里最多几行：整张歌单几千首时不把 DOM 拖慢，其余写“还有 N 首 · 查看已下载” */
export const PANEL_TASK_LIMIT = 50
/** 完成行的停留时间，连同状态切换时长一起等完后退场 */
export const LEAVING_HOLD_MS = 240

export interface LeavingTask {
  songId: number
  content: DownloadTask
  phase: 'run' | 'exit'
}

export type PanelRow
  = | { kind: 'leaving', key: string, leaving: LeavingTask }
    | { kind: 'task', key: string, task: DownloadTask }

/** 完成的那一行留在原位置；同一首不再画普通行，等它退场完 */
export const panelRows = (tasks: readonly DownloadTask[], leaving: readonly LeavingTask[]): PanelRow[] => [
  ...leaving.map(item => ({
    kind: 'leaving' as const,
    key: `task-${item.songId}`,
    leaving: item,
  })),
  ...tasks.filter(task => !leaving.some(item => item.songId === task.song.id)).map(task => ({
    kind: 'task' as const,
    key: `task-${task.song.id}`,
    task,
  })),
]

/** 保留完成任务的原行内容；父级负责 key、行高、FLIP 和移除时机 */
export const leavingOf = (task: DownloadTask): LeavingTask => ({
  songId: task.song.id,
  content: task,
  phase: 'run',
})

/** 下载中在最前，其次失败，最后排队；同一状态保持排队的先后 */
const RANK: Record<DownloadTask['status'], number> = {
  downloading: 0,
  failed: 1,
  queued: 2,
}
const rank = (task: DownloadTask): number => RANK[task.status]

export const visiblePanelTasks = (tasks: readonly DownloadTask[], limit = PANEL_TASK_LIMIT): DownloadTask[] => tasks
  .map((task, index) => ({ task, index }))
  .sort((a, b) => rank(a.task) - rank(b.task) || a.index - b.index)
  .slice(0, limit)
  .map(({ task }) => task)

/** 从没有任务变成有任务：面板立即出现，展开或收起由用户原有状态决定 */
export const panelOpensOn = (previous: number, next: number): boolean => previous === 0 && next > 0

/**
 * 这一帧里从任务表消失、并且已经写进本机的（下完了）：取消掉的、按歌单删掉的 has 是 false，不算完成。
 * previous 是上一帧的任务编号，顺序就是这一帧完成的先后。
 */
export const completedSince = (previous: readonly number[], next: readonly number[], has: (songId: number) => boolean): number[] => {
  const remaining = new Set(next)
  return previous.filter(songId => !remaining.has(songId) && has(songId))
}

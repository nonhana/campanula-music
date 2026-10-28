import { describe, expect, it } from 'vitest'

import type { DownloadTask } from '#lib/app/downloads.js'
import { completedSince, PANEL_TASK_LIMIT, panelOpensOn, visiblePanelTasks } from '#lib/components/downloads/download-panel-core.js'

// 下载面板（#38）：先显示哪些行、什么时候出来。
const song = (id: number): DownloadTask['song'] => ({
  id,
  name: `测试歌曲 ${id}`,
  artists: [],
  album: { id: 0, name: '测试专辑', coverUrl: null },
  duration: 180_000,
  downloadSize: null,
  availability: 'full',
  trackNumber: null,
  disc: null,
  aliases: [],
  translations: [],
  publishedAt: null,
})

const task = (id: number, status: DownloadTask['status']): DownloadTask => {
  const base = {
    song: song(id),
    sources: [
      { kind: 'single' } as const,
    ],
    received: 0,
    total: null,
  }
  switch (status) {
    case 'queued':
      return { status, ...base }
    case 'downloading':
      return { status, ...base }
    case 'failed':
      return {
        status,
        failure: { kind: 'interrupted' },
        ...base,
      }
    default: {
      const unhandled: never = status
      throw new Error(`不认识的下载状态：${JSON.stringify(unhandled)}`)
    }
  }
}

describe('下载面板的排序和上限', () => {
  it('下载中在最前，其次失败，最后排队；同一状态保持排队的先后', () => {
    const tasks = [
      task(1, 'queued'),
      task(2, 'failed'),
      task(3, 'downloading'),
      task(4, 'queued'),
      task(5, 'failed'),
      task(6, 'downloading'),
    ]

    expect(visiblePanelTasks(tasks).map(each => each.song.id)).toEqual([3, 6, 2, 5, 1, 4])
  })

  it('最多 50 行：多出来的不渲染（面板下面写还有多少首）', () => {
    const tasks = Array.from({ length: PANEL_TASK_LIMIT + 7 }, (_, index) => task(index + 1, 'queued'))
    expect(visiblePanelTasks(tasks)).toHaveLength(PANEL_TASK_LIMIT)
    expect(visiblePanelTasks(tasks, 3).map(each => each.song.id)).toEqual([1, 2, 3])
  })

  it('从没有任务变成有任务才该出来；换任务、清空都不重新飘入', () => {
    expect(panelOpensOn(0, 1)).toBe(true)
    expect(panelOpensOn(0, 5)).toBe(true)
    expect(panelOpensOn(1, 2)).toBe(false)
    expect(panelOpensOn(2, 0)).toBe(false)
    expect(panelOpensOn(0, 0)).toBe(false)
  })

  it('这一帧里消失、又已经写进本机的才算下完：取消的、删掉的不算', () => {
    expect(completedSince([1, 2, 3], [1, 2], id => id === 3)).toEqual([3])
    // 取消了（has 是 false）
    expect(completedSince([1, 2], [1], () => false)).toEqual([])
    // 还在任务表里
    expect(completedSince([1], [1], () => true)).toEqual([])
    // 同一帧完成两首：按上一帧的先后
    expect(completedSince([4, 5], [], () => true)).toEqual([4, 5])
  })
})

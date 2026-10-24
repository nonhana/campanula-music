import type { PlayerState } from '#lib/app/player.js'

import { reducedMotion } from '../shared/motion'

export interface Playhead {
  readonly now: number
}

/** 逐字歌词、波浪进度条用的时刻：播放器约 250ms 才报一次，在放时从最近一次按经过时间往前推、每帧更新；停着、缓冲时就是报的进度。减少动态效果时只跟着报的进度跳 */
export const createPlayhead = (read: () => PlayerState): Playhead => {
  // 只在进度、状态真的变了时重新起算：别的状态变了（例如曲库同步）不能把时刻拉回报的进度
  const position = $derived(read().position)
  const playing = $derived(read().status === 'playing')
  const duration = $derived(read().duration ?? Number.POSITIVE_INFINITY)
  let now = $state(read().position)

  $effect(() => {
    const from = position
    const end = duration
    now = from
    if (!playing || reducedMotion())
      return
    const since = performance.now()
    let frame = requestAnimationFrame(function tick(at) {
      now = Math.min(end, from + Math.max(0, at - since) / 1000)
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  })

  return {
    get now() {
      return now
    },
  }
}

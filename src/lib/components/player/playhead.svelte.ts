import type { PlayerState } from '#lib/app/player.js'
import { reducedMotion } from '../shared/motion'

export interface Playhead {
  /** 当前这首放到第几秒 */
  readonly now: number
}

/**
 * 播放页上逐字歌词、波浪进度条用的时刻。播放器大约 250ms 才报一次进度，逐字点亮会一顿一顿的：
 * 在放时从最近一次报的进度按经过的时间往前推，每帧更新；停着、缓冲时就是报的进度。
 * 减少动态效果时不往前推，只跟着报的进度跳。要在组件初始化时调用
 */
export function createPlayhead(read: () => PlayerState): Playhead {
  // 只在进度、状态真的变了时重新起算：App 别的状态变了（例如曲库同步）不能把时刻拉回最近一次报的进度
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

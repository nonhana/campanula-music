// PROTOTYPE · 逐字歌词用的平滑时钟。共用播放器每 250ms 前进一次，逐字扫光需要逐帧的时间，
// 这里在两次前进之间按真实时间插值；截图模式（still=1）直接用播放器的位置。
import { player } from '$lib/prototype/player.svelte'

class LyricClock {
  still = $state(true)
  smooth = $state(0)

  get t(): number {
    return this.still ? player.position : this.smooth
  }
}

export const clock = new LyricClock()

export function startClock(): () => void {
  let anchorPos = player.position
  let anchorAt = performance.now()
  let raf = 0
  clock.smooth = anchorPos
  const frame = (now: number) => {
    const pos = player.position
    if (pos !== anchorPos) {
      anchorPos = pos
      anchorAt = now
    }
    clock.smooth = player.playing ? anchorPos + Math.min(0.3, (now - anchorAt) / 1000) : anchorPos
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
  return () => cancelAnimationFrame(raf)
}

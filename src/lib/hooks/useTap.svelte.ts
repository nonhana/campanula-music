import { onDestroy, onMount } from 'svelte'

interface UseTapOptions {
  /** 触点移动距离阈值（默认 10px） */
  threshold?: number
  /** 最大 tap 持续时间（默认 300ms） */
  timeLimit?: number
  /** 点击事件 */
  onTap: (event: TouchEvent) => void
}

export function useTap(getter: () => HTMLElement | null, options: UseTapOptions) {
  const { threshold = 10, timeLimit = 300, onTap } = options

  let startX = 0
  let startY = 0
  let startTime = 0

  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0]
    startX = touch.clientX
    startY = touch.clientY
    startTime = Date.now()
  }

  const handleTouchEnd = (e: TouchEvent) => {
    const touch = e.changedTouches[0]
    const dx = touch.clientX - startX
    const dy = touch.clientY - startY
    const distance = Math.sqrt(dx * dx + dy * dy)
    const duration = Date.now() - startTime

    if (distance < threshold && duration < timeLimit) {
      onTap(e)
    }
  }

  onMount(() => {
    if (!getter())
      return

    getter()?.addEventListener('touchstart', handleTouchStart)
    getter()?.addEventListener('touchend', handleTouchEnd)
  })

  onDestroy(() => {
    if (!getter())
      return

    getter()?.removeEventListener('touchstart', handleTouchStart)
    getter()?.removeEventListener('touchend', handleTouchEnd)
  })
}

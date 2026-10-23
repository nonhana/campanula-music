/**
 * 窗口的 scroll-padding-top（DESIGN.md Layout · 滚动：顶栏高度再加 8px）。
 * 页面由窗口滚，这个值只能写在 documentElement 上；换屏时旧的一屏要淡出（+layout.svelte 的 {#key screen}），
 * 新旧两个外框会同时挂着，所以按挂载先后排队：旧外框卸下时只撤自己那一份，不会把新外框刚写上的清掉。
 * set 只改自己那一格的值，不会把旧外框重新排到后面（effect 因 top / 宽度变化重跑时也不会抢走最上面）。
 * 组件初始化时调用一次，onDestroy 时 release。
 */
const seats: { value: string }[] = []

function apply(): void {
  document.documentElement.style.scrollPaddingTop = seats.at(-1)?.value ?? ''
}

export interface PageScrollPadding {
  set: (value: string) => void
  release: () => void
}

export function pageScrollPadding(): PageScrollPadding {
  const seat = { value: '' }
  seats.push(seat)
  return {
    set(value) {
      if (seat.value === value)
        return
      seat.value = value
      apply()
    },
    release() {
      const index = seats.indexOf(seat)
      if (index !== -1)
        seats.splice(index, 1)
      apply()
    },
  }
}

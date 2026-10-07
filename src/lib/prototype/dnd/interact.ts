// PROTOTYPE：几个列表共用的点按逻辑——单击播放、Ctrl/⌘ 点选、Shift 连选、选择模式里轻点勾选；
// 长按之后跟着来的那次 click 要吞掉；“更多”菜单按输入方式决定是底部弹层还是浮动菜单。
import type { Attachment } from 'svelte/attachments'
import type { Song } from './data'
import { browser } from '$app/environment'
import { layout } from './layout.svelte'
import { playSong, selection, ui, view } from './store.svelte'

let suppressUntil = 0

/**
 * 长按、拖完之后浏览器可能还会补发一次 click：这次手势补发的 click 不算。
 * 下一次按下就说明上一个手势已经结束（补发的 click 早就过去了），立刻解除，免得吞掉紧接着的一次轻点；
 * 时间上限是给键盘的：键盘回车也会触发 click，但它前面没有按下。
 */
export function suppressClick(ms = 600) {
  suppressUntil = performance.now() + ms
}

export function clickSuppressed(): boolean {
  return performance.now() < suppressUntil
}

// 捕获阶段挂在 window 上：比任何列表自己的 pointerdown 都先执行，列表在按下时再调用 suppressClick 也不会被这里清掉
if (browser)
  window.addEventListener('pointerdown', () => (suppressUntil = 0), { capture: true })

export function vibrate(ms = 12) {
  try {
    navigator.vibrate?.(ms)
  }
  catch {}
}

/** 进入选择模式（长按松手 / 方案 C 的编辑按钮），或在选择模式里再长按一首：勾上或取消 */
export function longPressSelect(id: string) {
  if (selection.mode)
    selection.toggle(id)
  else selection.enter(id)
}

export function activateRow(e: MouseEvent, song: Song, list: Song[]) {
  if (clickSuppressed()) {
    e.preventDefault()
    return
  }
  if (selection.mode) {
    selection.toggle(song.id)
    // 长按进来的选择模式，勾完最后一首就退出；方案 C 的编辑模式要点“完成”才退出
    if (selection.size === 0 && view.dragVariant !== 'C')
      selection.exit()
    return
  }
  if (e.shiftKey) {
    selection.range(list, song.id)
    return
  }
  if (e.metaKey || e.ctrlKey) {
    selection.toggle(song.id)
    return
  }
  if (selection.size)
    selection.exit()
  playSong(song)
}

/** 触屏点“更多”用底部弹层；鼠标点或右键用浮动菜单（按输入方式，不按宽度） */
export function openMenu(e: MouseEvent, song: Song) {
  e.preventDefault()
  const pointerType = (e as PointerEvent).pointerType
  const isContext = e.type === 'contextmenu'
  if (isContext && pointerType === 'touch')
    return
  const sheet = !isContext && layout.phone && pointerType !== 'mouse'
  let x = e.clientX
  let y = e.clientY
  if (!isContext && e.currentTarget instanceof HTMLElement) {
    const r = e.currentTarget.getBoundingClientRect()
    x = r.right
    y = r.bottom + 4
  }
  ui.menu = { song, x, y, sheet }
}

export interface LongPressOptions {
  ms: () => number
  /** 返回 false 时不理会这次按下 */
  accept?: (e: PointerEvent, target: HTMLElement) => boolean
  onPress: (key: string) => void
}

/**
 * 只认触屏 / 手写笔的长按，挂在列表容器上，按行上的 data-key 找到是哪一首。
 * 手指挪动超过 8px（在滚动）、抬起、被浏览器取消，都会放弃这次长按。
 */
export function longPress(opts: LongPressOptions): Attachment<HTMLElement> {
  return (node) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let x0 = 0
    let y0 = 0
    let pid = -1

    function cancel() {
      clearTimeout(timer)
      timer = undefined
      pid = -1
    }

    function down(e: PointerEvent) {
      if (e.pointerType === 'mouse')
        return
      const t = e.target as HTMLElement
      const row = t.closest<HTMLElement>('[data-key]')
      if (!row || !node.contains(row) || t.closest('[data-more], [data-grip]'))
        return
      if (opts.accept && !opts.accept(e, t))
        return
      cancel()
      pid = e.pointerId
      x0 = e.clientX
      y0 = e.clientY
      const key = row.dataset.key!
      timer = setTimeout(() => {
        timer = undefined
        vibrate()
        suppressClick()
        opts.onPress(key)
      }, opts.ms())
    }

    function move(e: PointerEvent) {
      if (e.pointerId === pid && timer && Math.hypot(e.clientX - x0, e.clientY - y0) > 8)
        cancel()
    }

    function contextmenu(e: MouseEvent) {
      if ((e as PointerEvent).pointerType !== 'mouse')
        e.preventDefault()
    }

    node.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerup', cancel)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('scroll', cancel, { passive: true })
    node.addEventListener('contextmenu', contextmenu)
    return () => {
      cancel()
      node.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', cancel)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('scroll', cancel)
      node.removeEventListener('contextmenu', contextmenu)
    }
  }
}

/** 虚拟列表跟着整页滚动：算出视口里该渲染哪几行 */
export function visibleRange(host: HTMLElement, rowHeight: number, count: number, overscan = 8): { start: number, end: number } {
  const top = -host.getBoundingClientRect().top
  const start = Math.max(0, Math.floor(top / rowHeight) - overscan)
  const end = Math.min(count, Math.ceil((top + window.innerHeight) / rowHeight) + overscan)
  return { start, end: Math.max(start, end) }
}

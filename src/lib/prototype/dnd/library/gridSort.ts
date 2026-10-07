// PROTOTYPE：自写引擎的“格子 / 短列表”排序（曲库里的自建歌单只有十来张，不需要虚拟列表）。
// 按住（触屏长按或按把手、鼠标挪动 5px）后，被拖的那张浮起来跟着手指走，原位留一个空位；
// 其余的按手指底下最近的那张让开（FLIP 动画：记下旧位置，改顺序后从旧位置滑到新位置）；松手提交整组顺序。
// 手机上两列格子一屏放不下，拖到上下边缘会自动滚动（越靠边越快）。
import { tick } from 'svelte'
import { suppressClick, vibrate } from '../interact'

export interface GridSortOptions {
  /** 当前顺序（编号） */
  order: () => string[]
  /** 拖动中实时改顺序（只改界面） */
  preview: (ids: string[]) => void
  /** 松手：提交 */
  commit: (ids: string[], moved: boolean) => void
  /** true = 只能从把手拖（触屏和鼠标都是）；false = 触屏长按、鼠标按住任意位置都能拖 */
  handleOnly: () => boolean
  longPress: () => number
  /** 屏幕上下被固定栏挡住的高度（自动滚动的边缘区从这里开始算） */
  insets: () => { top: number, bottom: number }
  /** 浮起 / 放下：浮起时给出那张在屏幕上的位置，用来画跟手的浮层；放下时 id 是 null */
  onLift: (id: string | null, rect?: DOMRect) => void
  /** 手指离起点挪了多少（屏幕坐标） */
  onMove: (dx: number, dy: number) => void
}

const EDGE = 72
const MAX_SPEED = 1100

export function gridSort(opts: GridSortOptions) {
  return (node: HTMLElement) => {
    let pending: null | { id: string, el: HTMLElement, pid: number, x0: number, y0: number, touch: boolean, grip: boolean, timer?: ReturnType<typeof setTimeout> } = null
    let drag: null | { id: string, pid: number, x0: number, y0: number, px: number, py: number, start: string[], current: string[] } = null
    let raf = 0
    let lastT = 0
    let flipping = false

    function tiles(): HTMLElement[] {
      return [...node.querySelectorAll<HTMLElement>(':scope > [data-sort-key]')]
    }

    async function flipTo(ids: string[]) {
      const before = new Map(tiles().map(el => [el.dataset.sortKey!, el.getBoundingClientRect()] as const))
      flipping = true
      opts.preview(ids)
      await tick()
      for (const el of tiles()) {
        const key = el.dataset.sortKey!
        const a = before.get(key)
        if (!a || key === drag?.id)
          continue
        // 上一段让位动画还没走完：从它当前的样子接着滑，不跳
        for (const anim of el.getAnimations())
          anim.cancel()
        const b = el.getBoundingClientRect()
        const dx = a.left - b.left
        const dy = a.top - b.top
        if (dx || dy)
          el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
      }
      flipping = false
    }

    /** 格子在布局里的位置：去掉让位动画正在加的位移，否则动画途中会认错格子 */
    function layoutRect(el: HTMLElement): DOMRect {
      const r = el.getBoundingClientRect()
      const t = getComputedStyle(el).transform
      if (t === 'none')
        return r
      const m = new DOMMatrixReadOnly(t)
      return new DOMRect(r.left - m.m41, r.top - m.m42, r.width, r.height)
    }

    /**
     * 手指底下的那一张（不算被拖的那张）；在空隙里就不动。
     * 必须是"进到格子里面"才换：如果按"离得最近"换，换完以后让到空位上的那张反而最近，会马上换回去，来回抖。
     */
    function hit(x: number, y: number): string | null {
      for (const el of tiles()) {
        if (el.dataset.sortKey === drag?.id)
          continue
        const r = layoutRect(el)
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)
          return el.dataset.sortKey!
      }
      return null
    }

    function frame(now: number) {
      if (!drag)
        return
      const dt = Math.min(0.05, (now - lastT) / 1000)
      lastT = now
      // 自动滚动
      const { top, bottom } = opts.insets()
      const lo = top + EDGE
      const hi = window.innerHeight - bottom - EDGE
      const depth = drag.py < lo ? -(lo - drag.py) / EDGE : drag.py > hi ? (drag.py - hi) / EDGE : 0
      if (depth)
        window.scrollBy(0, Math.sign(depth) * Math.min(1, Math.abs(depth)) ** 2 * MAX_SPEED * dt)
      // 让位：页面在滚，格子的位置在变，所以每一帧都重新找
      if (!flipping) {
        const key = hit(drag.px, drag.py)
        if (key) {
          const cur = drag.current
          const from = cur.indexOf(drag.id)
          const to = cur.indexOf(key)
          if (from !== to) {
            const next = [...cur]
            next.splice(from, 1)
            next.splice(to, 0, drag.id)
            drag.current = next
            void flipTo(next)
          }
        }
      }
      raf = requestAnimationFrame(frame)
    }

    function start(p: NonNullable<typeof pending>, x: number, y: number) {
      clearPending()
      const order = opts.order()
      drag = { id: p.id, pid: p.pid, x0: x, y0: y, px: x, py: y, start: order, current: order }
      vibrate(10)
      suppressClick()
      opts.onLift(p.id, p.el.getBoundingClientRect())
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onCancel)
      lastT = performance.now()
      raf = requestAnimationFrame(frame)
    }

    function onMove(e: PointerEvent) {
      if (!drag || e.pointerId !== drag.pid)
        return
      drag.px = e.clientX
      drag.py = e.clientY
      opts.onMove(e.clientX - drag.x0, e.clientY - drag.y0)
    }

    function finish(canceled: boolean) {
      if (!drag)
        return
      const { start: s, current } = drag
      drag = null
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      suppressClick()
      if (canceled)
        opts.preview(s)
      opts.onLift(null)
      if (!canceled)
        opts.commit(current, current.join() !== s.join())
    }

    function onUp(e: PointerEvent) {
      if (drag && e.pointerId === drag.pid)
        finish(false)
    }

    function onCancel(e: PointerEvent) {
      if (drag && e.pointerId === drag.pid)
        finish(true)
    }

    function clearPending() {
      if (pending?.timer)
        clearTimeout(pending.timer)
      pending = null
      window.removeEventListener('pointermove', onPendingMove)
      window.removeEventListener('pointerup', clearPending)
      window.removeEventListener('pointercancel', clearPending)
    }

    function onPendingMove(e: PointerEvent) {
      if (!pending || e.pointerId !== pending.pid)
        return
      const d = Math.hypot(e.clientX - pending.x0, e.clientY - pending.y0)
      if (pending.touch) {
        // 长按还没到时手指就挪了：是在滚动
        if (d > 8)
          clearPending()
        return
      }
      if (d > 5)
        start(pending, e.clientX, e.clientY)
    }

    function down(e: PointerEvent) {
      if (drag || pending || (e.pointerType === 'mouse' && e.button !== 0))
        return
      const t = e.target as HTMLElement
      const el = t.closest<HTMLElement>('[data-sort-key]')
      if (!el || el.parentElement !== node)
        return
      const grip = Boolean(t.closest('[data-grip]'))
      if (opts.handleOnly() && !grip)
        return
      const touch = e.pointerType !== 'mouse'
      pending = { id: el.dataset.sortKey!, el, pid: e.pointerId, x0: e.clientX, y0: e.clientY, touch, grip }
      window.addEventListener('pointermove', onPendingMove)
      window.addEventListener('pointerup', clearPending)
      window.addEventListener('pointercancel', clearPending)
      if (grip) {
        // 把手上有 touch-action: none，不会和滚动抢：触屏按下立即浮起，鼠标挪动几像素后浮起
        e.preventDefault()
        if (touch)
          start(pending, e.clientX, e.clientY)
        return
      }
      if (touch) {
        pending.timer = setTimeout(() => {
          if (!pending)
            return
          vibrate()
          suppressClick()
          // 长按到时就浮起：不松手接着挪就是拖；原地松手就放回原处（曲库里的歌单没有多选）
          start(pending, pending.x0, pending.y0)
        }, opts.longPress())
      }
    }

    // 长按到时之后要挡住页面滚动：监听必须一开始就是非 passive 的
    function touchmove(e: TouchEvent) {
      if (drag)
        e.preventDefault()
    }

    function contextmenu(e: MouseEvent) {
      if ((e as PointerEvent).pointerType !== 'mouse')
        e.preventDefault()
    }

    function keyCancel(e: KeyboardEvent) {
      if (drag && e.key === 'Escape') {
        e.preventDefault()
        finish(true)
      }
    }

    node.addEventListener('pointerdown', down)
    node.addEventListener('touchmove', touchmove, { passive: false })
    node.addEventListener('contextmenu', contextmenu)
    window.addEventListener('keydown', keyCancel)
    return () => {
      clearPending()
      if (drag)
        finish(true)
      node.removeEventListener('pointerdown', down)
      node.removeEventListener('touchmove', touchmove)
      node.removeEventListener('contextmenu', contextmenu)
      window.removeEventListener('keydown', keyCancel)
    }
  }
}

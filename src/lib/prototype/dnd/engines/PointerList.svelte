<!--
  PROTOTYPE：引擎“自写”——用 pointer events 自己写的拖动排序，配合跟整页滚动的虚拟列表（只渲染视口附近几十行）。
  - 触屏：方案 A 长按整行（到时轻震一下、行浮起），不松手接着拖就是排序，松手就进入多选；方案 B/C 按住把手立即拖，长按行进入多选。
  - 鼠标：方案 A 按住整行挪动超过 5px 开始拖；B/C 只能从把手拖。单击仍然是播放。
  - 拖动时被拖的行从列表里拿掉，原位留一行空隙；被拖的那个 DOM 节点一直保留（隐藏），否则 Android 上手指底下的元素被移除后触摸事件会断。
  - 拖到上下边缘自动滚动：越深越快，停在边缘不动会继续加速（原型面板可调）；打开“快速定位”时拖到右侧窄条上按比例跳转。
  - 选择模式里拖一首已勾选的歌，会把勾选的几首一起拖过去。
  - 键盘：焦点在某一行时 Alt + ↑/↓ 上下移一位；拖动中按 Esc 取消。
-->
<script lang='ts'>
  import type { Song } from '../data'
  import type { Variant } from '../store.svelte'
  import { formatCount } from '../data'
  import { activateRow, longPressSelect, openMenu, suppressClick, vibrate, visibleRange } from '../interact'
  import { layout } from '../layout.svelte'
  import DesktopRow from '../rows/DesktopRow.svelte'
  import PhoneRow from '../rows/PhoneRow.svelte'
  import { settings } from '../settings.svelte'
  import { applyOrder, beginDragStats, dragStats, endDragStats, player, selection } from '../store.svelte'

  interface Props {
    list: Song[]
    plId: string
    /** 能不能拖：自建歌单、没有在搜索 */
    sortable: boolean
    phone: boolean
    variant: Variant
  }

  const { list, plId, sortable, phone, variant }: Props = $props()

  const ROW = 56
  const RAIL = 44

  let host = $state<HTMLElement>()
  let range = $state({ start: 0, end: 30 })

  // ── 拖动中的状态 ──
  let dragging = $state(false)
  let settling = $state(false)
  let rest = $state.raw<Song[]>([])
  let dragged = $state.raw<Song[]>([])
  /** 手指按住的那一首（多首一起拖时，浮起的行显示它） */
  let grabbed = $state.raw<Song | null>(null)
  let target = $state(0)
  let ghostY = $state(0)
  let scrubbing = $state(false)
  let pressed = $state<string | null>(null)
  let origins = new Map<string, number>()
  let startTarget = 0
  let grabY = 0
  let pointerX = 0
  let pointerY = 0
  let activePointer = -1
  let raf = 0
  let lastT = 0
  let hold = 0
  /** 这次拖动有没有用过快速定位条（结果里注明） */
  let usedScrubber = false
  /**
   * 快速定位条能不能接手：从条外开始拖，马上就能；从条里开始拖（方案 C 手机上的把手就在屏幕最右边这一条里），
   * 要先离开窄条再回来，否则一按把手往下挪，就被当成在快速定位，一下跳到几千首之后。
   */
  let railArmed = $state(false)

  const showGrip = $derived(sortable && (variant === 'B' || (variant === 'C' && selection.mode)))
  const gripAt = $derived(!showGrip ? 'none' : variant === 'B' ? 'lead' : 'end') as 'none' | 'lead' | 'end'
  const total = $derived(dragging ? rest.length + 1 : list.length)

  function measure() {
    if (!host)
      return
    const r = visibleRange(host, ROW, total)
    if (r.start !== range.start || r.end !== range.end)
      range = r
  }

  $effect(() => {
    void total
    measure()
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  })

  interface Item { song: Song, y: number, n: number, hidden: boolean }

  const items = $derived.by(() => {
    const out: Item[] = []
    if (!dragging) {
      const end = Math.min(range.end, list.length)
      for (let i = range.start; i < end; i++)
        out.push({ song: list[i], y: i * ROW, n: i + 1, hidden: false })
      return out
    }
    const end = Math.min(range.end, rest.length + 1)
    for (let row = range.start; row < end; row++) {
      if (row === target)
        continue
      const i = row < target ? row : row - 1
      out.push({ song: rest[i], y: row * ROW, n: row + 1, hidden: false })
    }
    // 被拖的行不卸载，只藏起来（见文件头的说明）
    for (const s of dragged)
      out.push({ song: s, y: origins.get(s.id) ?? 0, n: 0, hidden: true })
    return out
  })

  // ── 开始、进行、结束 ──

  function startDrag(id: string, rowEl: HTMLElement, x: number, y: number, pointerId: number) {
    const idx = list.findIndex(s => s.id === id)
    if (idx < 0)
      return
    const multi = selection.has(id) && selection.size > 1
    const ids = multi ? list.filter(s => selection.has(s.id)).map(s => s.id) : [id]
    const set = new Set(ids)
    const before = multi ? list.slice(0, idx).filter(s => set.has(s.id)).length : 0
    const rect = rowEl.getBoundingClientRect()

    origins = new Map(list.map((s, i) => [s.id, i * ROW] as const).filter(([sid]) => set.has(sid)))
    rest = list.filter(s => !set.has(s.id))
    // 一起拖的几首保持原来的先后顺序；浮起的那一行显示手指按住的那首
    dragged = list.filter(s => set.has(s.id))
    grabbed = list[idx]
    // 拖的是多首：前面被一起拿走的行收起来，页面往回滚同样的高度，手指底下的空隙不跳
    if (before)
      window.scrollBy(0, -before * ROW)
    target = idx - before
    startTarget = target
    grabY = y - rect.top
    pointerX = x
    pointerY = y
    ghostY = rect.top
    activePointer = pointerId
    scrubbing = false
    pressed = null
    hold = 0
    usedScrubber = false
    railArmed = x < window.innerWidth - RAIL
    dragging = true
    vibrate(10)
    suppressClick()
    beginDragStats('自写', idx + 1, ids.length)
    window.addEventListener('pointermove', onDragMove)
    window.addEventListener('pointerup', onDragUp)
    window.addEventListener('pointercancel', onDragCancel)
    window.addEventListener('keydown', onDragKey)
    lastT = performance.now()
    raf = requestAnimationFrame(frame)
  }

  function clamp(v: number, lo: number, hi: number) {
    return Math.min(hi, Math.max(lo, v))
  }

  function listTop(): number {
    return host ? host.getBoundingClientRect().top : 0
  }

  function frame(now: number) {
    const dt = Math.min(0.05, (now - lastT) / 1000)
    lastT = now
    const top = layout.topInset
    const bottom = window.innerHeight - layout.bottomInset
    const zone = settings.zone

    if (scrubbing) {
      hold = 0
    }
    else {
      let dir = 0
      let depth = 0
      if (pointerY < top + zone) {
        dir = -1
        depth = clamp((top + zone - pointerY) / zone, 0, 1)
      }
      else if (pointerY > bottom - zone) {
        dir = 1
        depth = clamp((pointerY - (bottom - zone)) / zone, 0, 1)
      }
      if (dir) {
        hold += dt
        // 越深越快（平方），停在边缘越久越快（按深度加权，轻轻碰到边缘时不会突然飞起来）
        const ramp = 1 + (settings.accel - 1) * clamp(hold / settings.accelTime, 0, 1) * depth
        const speed = settings.maxSpeed * depth * depth * ramp
        window.scrollBy(0, dir * speed * dt)
      }
      else {
        hold = 0
      }
      ghostY = clamp(pointerY - grabY, top - ROW / 2, bottom - ROW / 2)
      const center = ghostY + ROW / 2 - listTop()
      target = clamp(Math.floor(center / ROW), 0, rest.length)
    }
    dragStats.to = target + 1
    raf = requestAnimationFrame(frame)
  }

  function scrubTo(y: number) {
    // 和右侧窄条的轨道对齐：窄条上下各留 8px，轨道再缩进 24px 放首尾的数字
    const top = layout.topInset + 8 + 24
    const bottom = window.innerHeight - layout.bottomInset - 8 - 24
    const f = clamp((y - top) / (bottom - top), 0, 1)
    target = Math.round(f * rest.length)
    // 把落点滚到可见区域的正中，浮起的行就停在那道空隙上
    const mid = (layout.topInset + window.innerHeight - layout.bottomInset) / 2
    const hostDocTop = listTop() + window.scrollY
    window.scrollTo({ top: hostDocTop + target * ROW + ROW / 2 - mid })
    ghostY = listTop() + target * ROW
  }

  function onDragMove(e: PointerEvent) {
    if (e.pointerId !== activePointer)
      return
    pointerX = e.clientX
    pointerY = e.clientY
    if (!settings.scrubber)
      return
    const railLeft = window.innerWidth - RAIL
    if (!railArmed) {
      if (pointerX < railLeft - 24)
        railArmed = true
      return
    }
    if (!scrubbing && pointerX > railLeft) {
      scrubbing = true
      usedScrubber = true
      dragStats.scrubbing = true
      vibrate(6)
    }
    else if (scrubbing && pointerX < railLeft - 24) {
      scrubbing = false
      dragStats.scrubbing = false
    }
    if (scrubbing)
      scrubTo(pointerY)
  }

  function stopListening() {
    cancelAnimationFrame(raf)
    window.removeEventListener('pointermove', onDragMove)
    window.removeEventListener('pointerup', onDragUp)
    window.removeEventListener('pointercancel', onDragCancel)
    window.removeEventListener('keydown', onDragKey)
    activePointer = -1
  }

  function onDragUp(e: PointerEvent) {
    if (e.pointerId !== activePointer)
      return
    stopListening()
    const moved = target !== startTarget
    const next = [...rest.slice(0, target), ...dragged, ...rest.slice(target)]
    // 浮起的行落进空隙（160ms），落稳了再换成真正的顺序
    settling = true
    ghostY = listTop() + target * ROW
    suppressClick()
    dragStats.scrubbing = usedScrubber
    endDragStats(moved)
    setTimeout(() => {
      if (moved)
        applyOrder(plId, next)
      dragging = false
      settling = false
      scrubbing = false
      dragged = []
      rest = []
    }, 170)
  }

  function cancelDrag() {
    stopListening()
    endDragStats(false)
    dragging = false
    scrubbing = false
    dragged = []
    rest = []
  }

  function onDragCancel(e: PointerEvent) {
    if (e.pointerId === activePointer)
      cancelDrag()
  }

  function onDragKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      cancelDrag()
    }
  }

  // ── 按下：判断是拖、长按、还是普通点按 ──

  let pending: null | { id: string, row: HTMLElement, pid: number, x0: number, y0: number, touch: boolean, grip: boolean, armed: boolean, timer?: ReturnType<typeof setTimeout> } = null

  function clearPending() {
    if (pending?.timer)
      clearTimeout(pending.timer)
    pending = null
    pressed = null
    window.removeEventListener('pointermove', onPendingMove)
    window.removeEventListener('pointerup', onPendingUp)
    window.removeEventListener('pointercancel', clearPending)
  }

  function onpointerdown(e: PointerEvent) {
    if (dragging || settling || pending)
      return
    if (e.pointerType === 'mouse' && e.button !== 0)
      return
    const t = e.target as HTMLElement
    const row = t.closest<HTMLElement>('[data-key]')
    if (!row || !host?.contains(row) || t.closest('[data-more]'))
      return
    const grip = Boolean(t.closest('[data-grip]'))
    const touch = e.pointerType !== 'mouse'
    pending = { id: row.dataset.key!, row, pid: e.pointerId, x0: e.clientX, y0: e.clientY, touch, grip, armed: false }
    window.addEventListener('pointermove', onPendingMove)
    window.addEventListener('pointerup', onPendingUp)
    window.addEventListener('pointercancel', clearPending)

    if (grip && sortable) {
      // 把手：触屏立即浮起开始拖（把手上 touch-action: none，不会和滚动抢）；鼠标等挪动几像素
      e.preventDefault()
      if (touch) {
        const p = pending
        clearPending()
        startDrag(p.id, p.row, e.clientX, e.clientY, e.pointerId)
      }
      return
    }
    if (touch) {
      pending.timer = setTimeout(arm, settings.longPress)
    }
  }

  function arm() {
    if (!pending)
      return
    pending.armed = true
    pending.timer = undefined
    vibrate()
    suppressClick()
    if (variant === 'A' && sortable) {
      // 方案 A：先浮起，等手指的下一步——挪动就拖，松手就进入多选
      pressed = pending.id
    }
    else {
      const id = pending.id
      clearPending()
      longPressSelect(id)
    }
  }

  function onPendingMove(e: PointerEvent) {
    if (!pending || e.pointerId !== pending.pid)
      return
    const d = Math.hypot(e.clientX - pending.x0, e.clientY - pending.y0)
    if (pending.touch) {
      if (!pending.armed) {
        if (d > 8)
          clearPending() // 是在滚动
        return
      }
      if (d > 6) {
        const p = pending
        clearPending()
        startDrag(p.id, p.row, e.clientX, e.clientY, e.pointerId)
      }
      return
    }
    // 鼠标
    const canDrag = sortable && (variant === 'A' || pending.grip)
    if (canDrag && d > 5) {
      const p = pending
      clearPending()
      startDrag(p.id, p.row, e.clientX, e.clientY, e.pointerId)
    }
  }

  function onPendingUp(e: PointerEvent) {
    if (!pending || e.pointerId !== pending.pid)
      return
    if (pending.armed) {
      const id = pending.id
      clearPending()
      suppressClick()
      longPressSelect(id)
      return
    }
    clearPending()
  }

  // 长按到时之后要挡住页面滚动：监听必须一开始就是非 passive 的，Chrome 才肯让 preventDefault 生效
  function blockScroll(node: HTMLElement) {
    const onTouchMove = (e: TouchEvent) => {
      if (dragging || pending?.armed)
        e.preventDefault()
    }
    const onContext = (e: MouseEvent) => {
      if ((e as PointerEvent).pointerType !== 'mouse')
        e.preventDefault()
    }
    node.addEventListener('touchmove', onTouchMove, { passive: false })
    node.addEventListener('contextmenu', onContext)
    return () => {
      node.removeEventListener('touchmove', onTouchMove)
      node.removeEventListener('contextmenu', onContext)
    }
  }

  // ── 键盘：Alt + ↑/↓ ──
  function onkeydown(e: KeyboardEvent) {
    if (!sortable || !e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown'))
      return
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-key]')
    if (!row)
      return
    const i = list.findIndex(s => s.id === row.dataset.key)
    const j = e.key === 'ArrowUp' ? i - 1 : i + 1
    if (i < 0 || j < 0 || j >= list.length)
      return
    e.preventDefault()
    const next = [...list]
    ;[next[i], next[j]] = [next[j], next[i]]
    beginDragStats('自写·键盘', i + 1, 1)
    dragStats.to = j + 1
    endDragStats(true)
    applyOrder(plId, next)
  }

  $effect(() => () => {
    stopListening()
    clearPending()
  })

  const hostLeft = $derived.by(() => {
    void dragging
    const r = host?.getBoundingClientRect()
    return { left: r?.left ?? 0, width: r?.width ?? 0 }
  })
  const railTop = $derived(layout.topInset + 8)
  /** “拖到这里快速定位”放在浮起那一行的另一半屏幕，免得压住它和“移到第 N 首”的标签 */
  let viewportH = $state(844)
  const hintAt = $derived(ghostY + ROW / 2 < viewportH / 2 ? '75%' : '25%')
</script>

<svelte:window bind:innerHeight={viewportH} />

<!-- 按下、按键都是从行里的按钮冒泡上来的（事件委托），列表本身不需要能获得焦点 -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  bind:this={host}
  class={['plist relative', dragging && 'is-dragging', dragging && phone && settings.scrubber && 'clear-rail']}
  style:height='{total * ROW}px'
  role='list'
  aria-label='歌单里的歌曲'
  {onpointerdown}
  {onkeydown}
  {@attach blockScroll}
>
  {#each items as it (it.song.id)}
    <div
      class={['slot', it.hidden && 'is-hidden']}
      style:transform='translateY({it.y}px)'
      role='listitem'
    >
      {#if phone}
        <PhoneRow
          song={it.song}
          now={player.current === it.song.id}
          selecting={selection.mode}
          selected={selection.has(it.song.id)}
          grip={showGrip}
          lifted={pressed === it.song.id}
          onactivate={e => activateRow(e, it.song, list)}
          onmore={e => openMenu(e, it.song)}
          onmenu={e => openMenu(e, it.song)}
        />
      {:else}
        <DesktopRow
          song={it.song}
          n={it.n}
          now={player.current === it.song.id}
          selecting={selection.mode}
          selected={selection.has(it.song.id)}
          {gripAt}
          onactivate={e => activateRow(e, it.song, list)}
          onmore={e => openMenu(e, it.song)}
          onmenu={e => openMenu(e, it.song)}
        />
      {/if}
    </div>
  {/each}
</div>

{#if dragging && dragged.length}
  <div
    class={['ghost', settling && 'is-settling']}
    style:left='{hostLeft.left}px'
    style:width='{hostLeft.width}px'
    style:transform='translate3d(0, {ghostY}px, 0)'
    aria-hidden='true'
  >
    {#if phone}
      <PhoneRow song={grabbed ?? dragged[0]} ghost count={dragged.length} selecting={selection.mode} selected={selection.has((grabbed ?? dragged[0]).id)} grip={showGrip} />
    {:else}
      <DesktopRow song={grabbed ?? dragged[0]} n={target + 1} ghost count={dragged.length} selecting={selection.mode} selected={selection.has((grabbed ?? dragged[0]).id)} {gripAt} />
    {/if}
    {#if !settling}
      <span class={['pos tnum', phone && settings.scrubber && 'beside-rail']}>{scrubbing ? '定位到' : '移到'}第 {formatCount(target + 1)} 首</span>
    {/if}
  </div>

  {#if settings.scrubber && !settling}
    <div class={['rail', scrubbing && 'is-on']} style:top='{railTop}px' style:bottom='{layout.bottomInset + 8}px' aria-hidden='true'>
      <span class='rail-label top-1'>1</span>
      <span class='rail-body'>
        <span class='rail-track'></span>
        <span class='rail-thumb' style:top='{(target / Math.max(1, rest.length)) * 100}%'></span>
      </span>
      <span class='rail-label bottom-1'>{formatCount(rest.length + 1)}</span>
      <!-- 从窄条里开始拖（方案 C 的把手）时先不提示：手指本来就在这里，要先往左离开窄条，快速定位才接手 -->
      {#if !scrubbing && railArmed}<span class='rail-hint' style:top={hintAt}>拖到这里<br />快速定位</span>{/if}
    </div>
  {/if}
{/if}

<style>
  /* 手机上快速定位条压在每一行的最右边：拖动时其余行右边的按钮（更多、把手）淡出，不和窄条叠在一起 */
  .slot :global([data-more]),
  .slot :global([data-grip]) {
    transition: opacity 120ms ease-out;
  }

  .clear-rail .slot :global([data-more]),
  .clear-rail .slot :global([data-grip]) {
    opacity: 0;
  }

  .plist {
    contain: layout;
  }

  .slot {
    position: absolute;
    inset: 0 0 auto 0;
    height: 56px;
    will-change: transform;
  }

  /* 拖动时其余行滑开、合拢；不拖时位置只随虚拟窗口出现消失，不加过渡 */
  .is-dragging .slot {
    transition: transform 170ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .slot.is-hidden {
    visibility: hidden;
    pointer-events: none;
  }

  .ghost {
    position: fixed;
    top: 0;
    z-index: 60;
    height: 56px;
    pointer-events: none;
    will-change: transform;
  }

  .ghost.is-settling {
    transition: transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .ghost :global(.prow),
  .ghost :global(.drow) {
    transform: scale(1.02);
  }

  /* 压在浮起的那一行上面：手机的行浮起时自己带 z-index: 2，标签不设的话下半截会被行盖住 */
  .pos {
    position: absolute;
    z-index: 3;
    right: 12px;
    top: -14px;
    padding: 0 10px;
    border-radius: 9999px;
    background: #1a5b43;
    color: #fff;
    font-size: 12px;
    font-weight: 500;
    line-height: 24px;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgb(17 24 39 / 0.16);
  }

  /* 手机上浮起的行占满屏宽，右边 44px 是快速定位条：标签挪到它左边 */
  .pos.beside-rail {
    right: 52px;
  }

  .rail {
    position: fixed;
    right: 0;
    z-index: 55;
    width: 44px;
    pointer-events: none;
  }

  .rail-body {
    position: absolute;
    top: 24px;
    bottom: 24px;
    left: 0;
    right: 0;
  }

  /* 按住时变粗：用 scale 而不是改宽度，不触发重新排版 */
  .rail-track {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 8px;
    margin-left: -4px;
    border-radius: 9999px;
    background: #d1f1e3;
    scale: 0.5 1;
    transition: scale 140ms ease-out, background-color 140ms ease-out;
  }

  .rail.is-on .rail-track {
    background: #b9ead5;
    scale: 1 1;
  }

  .rail-thumb {
    position: absolute;
    left: 50%;
    width: 20px;
    height: 20px;
    margin: -10px 0 0 -10px;
    border: 2px solid #fff;
    border-radius: 9999px;
    background: #206f52;
    box-shadow: 0 1px 4px rgb(17 24 39 / 0.25);
  }

  .rail-label {
    position: absolute;
    left: 0;
    right: 0;
    color: #4b5563;
    font-size: 11px;
    font-weight: 500;
    text-align: center;
  }

  .rail-hint {
    position: absolute;
    top: 50%;
    right: 48px;
    padding: 6px 10px;
    border-radius: 12px;
    background: #fff;
    color: #374151;
    font-size: 12px;
    line-height: 16px;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgb(17 24 39 / 0.12);
    translate: 0 -50%;
  }

  @media (prefers-reduced-motion: reduce) {
    .is-dragging .slot,
    .ghost.is-settling {
      transition: none;
    }
  }
</style>

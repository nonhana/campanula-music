<!--
  PROTOTYPE：正方形取景器。图片在固定的正方形框下面移动、缩放：一根手指拖动，两根手指捏合，鼠标滚轮缩放，下面的滑块也能缩放；
  方向键移动，+ / - 缩放。框外露出的部分盖一层晨光底色的薄纱（只有浅色，ADR-0008）。
  crop 是原图像素坐标（双向绑定），导出时直接用。
-->
<script lang='ts'>
  import type { Crop } from './image'
  import { Minus, Plus } from '@lucide/svelte'
  import { untrack } from 'svelte'

  interface Props {
    src: string
    width: number
    height: number
    /** 取景框边长（CSS 像素） */
    size: number
    /** 取景框左右额外露出的宽度（框外半透明） */
    bleed?: number
    /** 取景框上下额外露出的高度；不传就和左右一样 */
    bleedY?: number
    crop: Crop
  }

  let { src, width, height, size, bleed = 0, bleedY, crop = $bindable() }: Props = $props()
  const by = $derived(bleedY ?? bleed)

  const base = $derived(size / Math.min(width, height))
  const maxZoom = $derived(Math.max(1, Math.min(6, Math.min(width, height) / 160)))

  // 从传进来的 crop 还原缩放和位置
  let zoom = $state(1)
  let tx = $state(0)
  let ty = $state(0)
  let dragging = $state(false)

  // 只在图片或框的尺寸变化时，按传进来的 crop 重新摆放；之后由手势改 crop
  $effect.pre(() => {
    void src
    void size
    untrack(() => {
      const s = size / crop.size
      zoom = Math.min(maxZoom, Math.max(1, s / base))
      const sc = base * zoom
      tx = -crop.x * sc
      ty = -crop.y * sc
      clamp()
    })
  })

  const scale = $derived(base * zoom)
  const W = $derived(width * scale)
  const H = $derived(height * scale)

  function clamp() {
    const sc = base * zoom
    tx = Math.min(0, Math.max(size - width * sc, tx))
    ty = Math.min(0, Math.max(size - height * sc, ty))
  }

  function sync() {
    clamp()
    const sc = base * zoom
    crop = { x: -tx / sc, y: -ty / sc, size: size / sc }
  }

  /** 以框内的点 (px, py) 为中心缩放 */
  function zoomAt(next: number, px = size / 2, py = size / 2) {
    const z = Math.min(maxZoom, Math.max(1, next))
    const s1 = base * zoom
    const s2 = base * z
    tx = px - ((px - tx) * s2) / s1
    ty = py - ((py - ty) * s2) / s1
    zoom = z
    sync()
  }

  const pointers = new Map<number, { x: number, y: number }>()
  let pinch: null | { d: number, zoom: number } = null
  let host = $state<HTMLElement>()

  function local(e: PointerEvent) {
    const r = host!.getBoundingClientRect()
    return { x: e.clientX - r.left - bleed, y: e.clientY - r.top - by }
  }

  function onpointerdown(e: PointerEvent) {
    host?.setPointerCapture(e.pointerId)
    pointers.set(e.pointerId, local(e))
    dragging = true
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom }
    }
  }

  function onpointermove(e: PointerEvent) {
    const prev = pointers.get(e.pointerId)
    if (!prev)
      return
    const p = local(e)
    pointers.set(e.pointerId, p)
    if (pointers.size >= 2 && pinch) {
      const [a, b] = [...pointers.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      zoomAt(pinch.zoom * (d / pinch.d), (a.x + b.x) / 2, (a.y + b.y) / 2)
      return
    }
    tx += p.x - prev.x
    ty += p.y - prev.y
    sync()
  }

  function onpointerup(e: PointerEvent) {
    pointers.delete(e.pointerId)
    if (pointers.size < 2)
      pinch = null
    if (pointers.size === 0)
      dragging = false
  }

  function onwheel(e: WheelEvent) {
    e.preventDefault()
    const r = host!.getBoundingClientRect()
    zoomAt(zoom * Math.exp(-e.deltaY / 400), e.clientX - r.left - bleed, e.clientY - r.top - by)
  }

  function onkeydown(e: KeyboardEvent) {
    const step = e.shiftKey ? 40 : 10
    if (e.key === 'ArrowLeft')
      tx += step
    else if (e.key === 'ArrowRight')
      tx -= step
    else if (e.key === 'ArrowUp')
      ty += step
    else if (e.key === 'ArrowDown')
      ty -= step
    else if (e.key === '+' || e.key === '=')
      return zoomAt(zoom * 1.15)
    else if (e.key === '-')
      return zoomAt(zoom / 1.15)
    else return
    e.preventDefault()
    sync()
  }
</script>

<div class='flex flex-col items-center gap-3'>
  <!-- role=application：取景框自己处理方向键和 +/-，需要能获得焦点 -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    bind:this={host}
    class='crop relative overflow-hidden rounded-2xl'
    style:width='{size + bleed * 2}px'
    style:height='{size + by * 2}px'
    role='application'
    aria-label='调整封面的取景：拖动移动，捏合或滚轮缩放，方向键微调'
    tabindex='0'
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onpointercancel={onpointerup}
    {onwheel}
    {onkeydown}
  >
    <img
      {src}
      alt=''
      draggable='false'
      class='pointer-events-none absolute left-0 top-0 max-w-none select-none'
      style:width='{W}px'
      style:height='{H}px'
      style:transform='translate3d({bleed + tx}px, {by + ty}px, 0)'
    />
    <div class={['frame pointer-events-none absolute rounded-xl', dragging && 'is-dragging']} style:inset='{by}px {bleed}px' aria-hidden='true'>
      <span class='third v1'></span><span class='third v2'></span><span class='third h1'></span><span class='third h2'></span>
    </div>
  </div>
  <div class='flex w-full max-w-[320px] items-center gap-2 text-neutral-600'>
    <button type='button' class='zbtn grid size-9 flex-none place-items-center rounded-full' aria-label='缩小' onclick={() => zoomAt(zoom / 1.2)}><Minus size={16} aria-hidden='true' /></button>
    <input
      type='range'
      class='zoom min-w-0 flex-1'
      min='1'
      max={maxZoom}
      step='0.01'
      value={zoom}
      aria-label='缩放'
      disabled={maxZoom <= 1}
      oninput={e => zoomAt(Number(e.currentTarget.value))}
    />
    <button type='button' class='zbtn grid size-9 flex-none place-items-center rounded-full' aria-label='放大' onclick={() => zoomAt(zoom * 1.2)}><Plus size={16} aria-hidden='true' /></button>
  </div>
</div>

<style>
  .crop {
    background: #e8f8f1;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }

  .crop:active {
    cursor: grabbing;
  }

  /* 框外：晨光底色的薄纱；框：白色细边 + 一点阴影，让它在浅色图片上也看得见 */
  .frame {
    box-shadow:
      0 0 0 9999px rgb(245 252 249 / 0.78),
      inset 0 0 0 2px #fff,
      0 0 0 1px rgb(17 24 39 / 0.18);
  }

  .third {
    position: absolute;
    background: rgb(255 255 255 / 0.7);
    opacity: 0;
    transition: opacity 160ms ease-out;
  }

  .is-dragging .third {
    opacity: 1;
  }

  .v1,
  .v2 {
    top: 0;
    bottom: 0;
    width: 1px;
  }

  .v1 {
    left: 33.333%;
  }

  .v2 {
    left: 66.666%;
  }

  .h1,
  .h2 {
    left: 0;
    right: 0;
    height: 1px;
  }

  .h1 {
    top: 33.333%;
  }

  .h2 {
    top: 66.666%;
  }

  .zoom {
    accent-color: #206f52;
  }

  .zbtn:active {
    background: #e8f8f1;
  }

  @media (hover: hover) and (pointer: fine) {
    .zbtn:hover {
      background: #e8f8f1;
      color: #1a5b43;
    }
  }
</style>

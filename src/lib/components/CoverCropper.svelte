<!--
  正方形取景器（#34，原型 Cropper）：图片在固定的正方形框下面移动、缩放。
  一根手指拖动，两根手指捏合，鼠标滚轮缩放，下面的滑块也能缩放；方向键移动，+ / - 缩放。
  框外盖一层晨光底色的薄纱，框是白色细边（浅色图片上也看得见）。拖动时页面和弹层都不滚（touch-action: none）。
  crop 是工作位图上的正方形（单位是那张位图的像素），双向绑定；导出时直接用。
  readonly：上传中、失败后只看取景结果，不再接收手势，也不显示滑块。
-->
<script lang='ts'>
  import type { CoverCrop } from '#lib/api/cover.js'
  import { Minus, Plus } from '@lucide/svelte'
  import { untrack } from 'svelte'
  import IconButton from './ui/IconButton.svelte'

  interface Props {
    src: string
    width: number
    height: number
    /** 取景框边长（CSS 像素） */
    size: number
    /** 只看：上传中、失败后 */
    readonly?: boolean
    crop: CoverCrop
  }

  let { src, width, height, size, readonly = false, crop = $bindable() }: Props = $props()
  const base = $derived(size / Math.min(width, height))
  /** 最多放大到 6 倍；原图本来就小（短边不到 160px 的 6 倍）时不再放大 */
  const maxZoom = $derived(Math.max(1, Math.min(6, Math.min(width, height) / 160)))

  let zoom = $state(1)
  let tx = $state(0)
  let ty = $state(0)
  let dragging = $state(false)
  let host = $state<HTMLElement>()
  /** 已经摆好的取景框：和 crop 一样就说明是手势自己改的，不用再摆（不然会和拖动抢） */
  let placed: CoverCrop | null = null
  let placedFor = { src: '', size: 0 }

  // 图片、框的尺寸变了，或者外面换了 crop（换了一张图、打开时居中）：按它重新摆放。
  // 手势自己改 crop 时已经摆好，跳过
  $effect.pre(() => {
    const next = crop
    const sameFrame = src === placedFor.src && size === placedFor.size
    placedFor = { src, size }
    if (sameFrame && placed && placed.x === next.x && placed.y === next.y && placed.size === next.size)
      return
    untrack(() => {
      const scale = size / next.size
      zoom = Math.min(maxZoom, Math.max(1, scale / base))
      const sc = base * zoom
      tx = -next.x * sc
      ty = -next.y * sc
      clamp()
    })
    placed = { ...next }
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
    placed = { ...crop }
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

  const pointers: Record<number, { x: number, y: number }> = {}
  let pinch: null | { d: number, zoom: number } = null

  function local(e: PointerEvent) {
    const rect = host!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onpointerdown(e: PointerEvent) {
    if (readonly)
      return
    host?.setPointerCapture(e.pointerId)
    pointers[e.pointerId] = local(e)
    dragging = true
    if (Object.keys(pointers).length === 2) {
      const [a, b] = Object.values(pointers)
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom }
    }
  }

  function onpointermove(e: PointerEvent) {
    if (readonly)
      return
    const previous = pointers[e.pointerId]
    if (!previous)
      return
    const point = local(e)
    pointers[e.pointerId] = point
    if (Object.keys(pointers).length >= 2 && pinch) {
      const [a, b] = Object.values(pointers)
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      zoomAt(pinch.zoom * (d / pinch.d), (a.x + b.x) / 2, (a.y + b.y) / 2)
      return
    }
    tx += point.x - previous.x
    ty += point.y - previous.y
    sync()
  }

  function onpointerup(e: PointerEvent) {
    delete pointers[e.pointerId]
    if (Object.keys(pointers).length < 2)
      pinch = null
    if (Object.keys(pointers).length === 0)
      dragging = false
  }

  function onwheel(e: WheelEvent) {
    if (readonly)
      return
    e.preventDefault()
    const rect = host!.getBoundingClientRect()
    zoomAt(zoom * Math.exp(-e.deltaY / 400), e.clientX - rect.left, e.clientY - rect.top)
  }

  function onkeydown(e: KeyboardEvent) {
    if (readonly)
      return
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
    else
      return
    e.preventDefault()
    sync()
  }
</script>

<div class='flex flex-col items-center gap-3'>
  <!-- role=application：取景框自己处理方向键和 +/-，需要能获得焦点 -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    bind:this={host}
    class={['crop relative overflow-hidden rounded-xl bg-primary-100', readonly ? 'is-readonly' : '']}
    style:width='{size}px'
    style:height='{size}px'
    role={readonly ? 'img' : 'application'}
    aria-label={readonly ? '取景框里的封面预览' : '调整封面的取景：拖动移动，捏合或滚轮缩放，方向键微调'}
    tabindex={readonly ? undefined : 0}
    onpointerdown={onpointerdown}
    onpointermove={onpointermove}
    onpointerup={onpointerup}
    onpointercancel={onpointerup}
    onwheel={onwheel}
    onkeydown={onkeydown}
  >
    <img
      src={src}
      alt=''
      draggable='false'
      class='pointer-events-none absolute left-0 top-0 max-w-none select-none'
      style:width='{W}px'
      style:height='{H}px'
      style:transform='translate3d({tx}px, {ty}px, 0)'
    />
    <div class={['frame pointer-events-none absolute inset-0 rounded-lg', dragging && 'is-dragging']} aria-hidden='true'>
      <span class='third v1'></span><span class='third v2'></span><span class='third h1'></span><span class='third h2'></span>
    </div>
  </div>
  {#if !readonly}
    <div class='max-w-80 w-full flex items-center gap-2 text-neutral-600'>
      <IconButton icon={Minus} label='缩小' onclick={() => zoomAt(zoom / 1.2)} />
      <input
        type='range'
        class='min-w-0 flex-1'
        min='1'
        max={maxZoom}
        step='0.01'
        value={zoom}
        aria-label='缩放'
        disabled={maxZoom <= 1}
        oninput={event => zoomAt(Number(event.currentTarget.value))}
      />
      <IconButton icon={Plus} label='放大' onclick={() => zoomAt(zoom * 1.2)} />
    </div>
  {/if}
</div>

<style>
  .crop {
    cursor: grab;
    touch-action: none;
    user-select: none;
    overscroll-behavior: contain;
  }

  .crop:active {
    cursor: grabbing;
  }

  .crop.is-readonly,
  .crop.is-readonly:active {
    cursor: default;
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
    transition: opacity var(--duration-feedback) var(--ease-out-soft);
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
</style>

<!--
  歌单封面的正方形取景器（#34，原型 Cropper）：图片在固定的正方形框下面移动、缩放。
  一根手指拖动，两根手指捏合，鼠标滚轮缩放，下面的滑块也能缩放；方向键移动，+ / - 缩放。
  框外盖一层晨光底色的薄纱，框是白色细边（浅色图片上也看得见）。拖动时页面和弹层都不滚（touch-action: none）。
  crop 是工作位图上的正方形（单位是那张位图的像素），双向绑定；导出时直接用。
  几何（平移、缩放、夹紧、crop ↔ 视图）在 cover-crop-core.ts 的纯核心里；指针接线用 press.ts 的 attachGrip，
  按住断了（右键菜单、切走窗口、指针被收回、元素没了）就停止，不会留下悬停也在平移。
  readonly：上传中、失败后只看取景结果，不再接收手势，也不显示滑块。
-->
<script lang='ts'>
  import { ZoomIn, ZoomOut } from '@lucide/svelte'
  import { untrack } from 'svelte'
  import { SvelteMap } from 'svelte/reactivity'

  import type { CoverCrop } from '#lib/api/cover.js'

  import type { Grip, PointerSample } from '../shared/press'
  import { attachGrip, pressBroken } from '../shared/press'
  import IconButton from '../ui/IconButton.svelte'
  import { createCropView, cropOf, maxZoomOf, nudgeCrop, panCrop, pinchCrop, wheelCrop, zoomBy, zoomTo } from './cover-crop-core'
  import type { CropFrame, CropPoint, CropView } from './cover-crop-core.js'

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
  const frame = $derived<CropFrame>({ width, height, size })

  let view = $state.raw<CropView>({ zoom: 1, x: 0, y: 0 })
  let host = $state<HTMLElement>()
  let dragging = $state(false)
  /** 已经摆好的取景框：和 crop 一样就说明是手势自己改的，不用再摆（不然会和拖动抢） */
  let placed: CoverCrop | null = null
  let placedFor = { src: '', size: 0 }

  // 图片、框的尺寸变了，或者外面换了 crop（换了一张图、打开时居中）：按它重新摆放。
  // 手势自己改 crop 时已经摆好，跳过
  $effect.pre(() => {
    const current = frame
    const next = crop
    const sameFrame = src === placedFor.src && size === placedFor.size
    placedFor = { src, size }
    if (sameFrame && placed && placed.x === next.x && placed.y === next.y && placed.size === next.size)
      return
    untrack(() => {
      view = createCropView(current, next)
      placed = { ...next }
    })
  })

  const scale = $derived((size / Math.min(width, height)) * view.zoom)
  const W = $derived(width * scale)
  const H = $derived(height * scale)

  /** 手势改出来的新视图：记下来，顺手算出 crop */
  const apply = (next: CropView) => {
    view = next
    crop = cropOf(frame, view)
    placed = { ...crop }
  }

  /** 框里的坐标 */
  const at = (sample: { x: number, y: number }): CropPoint => {
    const rect = host!.getBoundingClientRect()
    return { x: sample.x - rect.left, y: sample.y - rect.top }
  }

  // 两指捏合：第二根手指不在 attachGrip 的主指针范围里，单独记着它们的位置。
  // 每次移动从**当前**视图缩放到「起始缩放 × 当前距离/起始距离」，锚当前中点（和基线增量 zoomAt 等价）：
  // 两指同距平移时不平移图片。
  const pointers = new SvelteMap<number, CropPoint>()
  let pinch: null | { zoom: number, distance: number } = null

  // 一指拖动：attachGrip 管指针捕获、按住断了、作废；这里只把移动交给几何核心
  let last: CropPoint | null = null

  /** 按住断了（右键、切走窗口、指针被收回、按钮已经松开）或 readonly 中途翻转：收手，不提交 */
  const abandonPan = (pointerId?: number) => {
    // 第二根手指被取消、收回捕获：只收它，正在拖的那一根接着走
    if (pointerId !== undefined) {
      pointers.delete(pointerId)
      if (pointers.size > 0) {
        if (pointers.size < 2)
          pinch = null
        last = [
          ...pointers.values(),
        ][0] ?? null
        dragging = true
        return
      }
    }
    pointers.clear()
    pinch = null
    last = null
    dragging = false
  }

  const pan: Grip = {
    get holding() {
      return dragging
    },
    press(sample: PointerSample) {
      if (readonly || !sample.isPrimary || sample.button !== 0)
        return false
      // 基线：按下就记下起点，第一次 pointermove 的位移也要算进去
      last = at(sample)
      dragging = true
      return true
    },
    move(sample) {
      // readonly 中途翻转：收手。别的指针悬停（buttons=0）不能中止正在进行的触屏拖动
      if (readonly)
        return abandonPan()
      if (!pointers.has(sample.pointerId))
        return
      if (pressBroken(sample.buttons))
        return abandonPan(sample.pointerId)
      const point = at(sample)
      const previous = last
      last = point
      if (!previous || pointers.size >= 2)
        return
      apply(panCrop(frame, view, point.x - previous.x, point.y - previous.y))
    },
    release(sample) {
      pointers.delete(sample.pointerId)
      if (pointers.size < 2)
        pinch = null
      last = [
        ...pointers.values(),
      ][0] ?? null
      dragging = pointers.size > 0
    },
    abandon: abandonPan,
    click() {
      return false
    },
  }
  const panAttach = attachGrip(pan)

  const touchPoint = (event: PointerEvent): CropPoint => at(event)

  const onpointerdown = (event: PointerEvent) => {
    if (readonly)
      return
    host?.setPointerCapture(event.pointerId)
    pointers.set(event.pointerId, touchPoint(event))
    dragging = true
    if (pointers.size === 2)
      startPinch()
  }

  const onpointermove = (event: PointerEvent) => {
    if (readonly) {
      abandonPan()
      return
    }
    if (!pointers.has(event.pointerId))
      return
    if (pressBroken(event.buttons)) {
      abandonPan(event.pointerId)
      return
    }
    const point = touchPoint(event)
    pointers.set(event.pointerId, point)
    if (pointers.size < 2)
      return
    if (!pinch)
      startPinch()
    if (!pinch)
      return
    const [a, b] = [
      ...pointers.values(),
    ]
    if (!a || !b)
      return
    const distance = Math.hypot(a.x - b.x, a.y - b.y)
    const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    apply(pinchCrop(frame, view, pinch.zoom, pinch.distance, distance, middle))
  }

  const onpointerup = (event: PointerEvent) => {
    pointers.delete(event.pointerId)
    if (pointers.size < 2)
      pinch = null
    // 从捏合回到一指：从这一刻的位置接着拖，不要跳
    const [first] = [
      ...pointers.values(),
    ]
    last = first ?? null
    dragging = pointers.size > 0
  }

  const startPinch = () => {
    const [a, b] = [
      ...pointers.values(),
    ]
    if (!a || !b)
      return
    pinch = {
      zoom: view.zoom,
      distance: Math.hypot(a.x - b.x, a.y - b.y),
    }
  }

  const onwheel = (event: WheelEvent) => {
    if (readonly)
      return
    event.preventDefault()
    apply(wheelCrop(frame, view, event.deltaY, at(event)))
  }

  const onkeydown = (event: KeyboardEvent) => {
    if (readonly)
      return
    const next = nudgeCrop(frame, view, event.key, event.shiftKey)
    if (!next)
      return
    event.preventDefault()
    apply(next)
  }
</script>

<div class='flex flex-col items-center gap-3'>
  <!-- role=application：取景框自己处理方向键和 +/-，需要能获得焦点 -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    bind:this={host}
    class={[
      'crop relative overflow-hidden rounded-xl bg-primary-100',
      readonly ? 'is-readonly' : '',
    ]}
    style:width='{size}px'
    style:height='{size}px'
    role={readonly ? 'img' : 'application'}
    aria-label={readonly ? '取景框里的封面预览' : '调整封面的取景：拖动移动，捏合或滚轮缩放，方向键微调'}
    tabindex={readonly ? undefined : 0}
    onpointerdown={onpointerdown}
    onpointermove={onpointermove}
    onpointerup={onpointerup}
    onpointercancel={onpointerup}
    onlostpointercapture={onpointerup}
    onwheel={onwheel}
    onkeydown={onkeydown}
    {@attach panAttach}
  >
    <img
      src={src}
      alt=''
      draggable='false'
      class='pointer-events-none absolute left-0 top-0 max-w-none select-none'
      style:width='{W}px'
      style:height='{H}px'
      style:transform='translate3d({view.x}px, {view.y}px, 0)'
    />
    <div class={['frame pointer-events-none absolute inset-0 rounded-lg', dragging && 'is-dragging']} aria-hidden='true'>
      <span class='third v1'></span><span class='third v2'></span><span class='third h1'></span><span class='third h2'></span>
    </div>
  </div>
  {#if !readonly}
    <div class='max-w-80 w-full flex items-center gap-2 text-neutral-600'>
      <IconButton icon={ZoomOut} label='缩小' onclick={() => apply(zoomBy(frame, view, 1 / 1.2))} />
      <input
        type='range'
        class='min-w-0 flex-1'
        min='1'
        max={maxZoomOf(frame)}
        step='0.01'
        value={view.zoom}
        aria-label='缩放'
        disabled={maxZoomOf(frame) <= 1}
        oninput={event => apply(zoomTo(frame, view, Number(event.currentTarget.value)))}
      />
      <IconButton icon={ZoomIn} label='放大' onclick={() => apply(zoomBy(frame, view, 1.2))} />
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

<script lang="ts">
  import { ZoomIn, ZoomOut } from '@lucide/svelte';
  import { untrack } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';

  import type { CoverCrop } from '#lib/api/cover.js';

  import type { Grip, PointerSample } from '../shared/press';
  import { attachGrip, rightButtonDown } from '../shared/press';
  import IconButton from '../ui/IconButton.svelte';
  import {
    createCropView,
    cropOf,
    maxZoomOf,
    nudgeCrop,
    panCrop,
    pinchCrop,
    wheelCrop,
    zoomBy,
    zoomTo,
  } from './cover-crop-core';
  import type { CropFrame, CropPoint, CropView } from './cover-crop-core.js';

  interface Props {
    src: string;
    width: number;
    height: number;
    size: number;
    readonly?: boolean;
    crop: CoverCrop;
  }

  let {
    src,
    width,
    height,
    size,
    readonly = false,
    crop = $bindable(),
  }: Props = $props();
  const frame = $derived<CropFrame>({ width, height, size });

  let view = $state.raw<CropView>({ zoom: 1, x: 0, y: 0 });
  let host = $state<HTMLElement>();
  let dragging = $state(false);
  // 和 crop 一样就是手势改的，跳过重摆（不然和拖动抢）；图片/框尺寸变了或外面换了 crop 才重摆
  let placed: CoverCrop | null = null;
  let placedFor = { src: '', size: 0 };

  $effect.pre(() => {
    const current = frame;
    const next = crop;
    const sameFrame = src === placedFor.src && size === placedFor.size;
    placedFor = { src, size };
    if (
      sameFrame &&
      placed &&
      placed.x === next.x &&
      placed.y === next.y &&
      placed.size === next.size
    )
      return;
    untrack(() => {
      view = createCropView(current, next);
      placed = { ...next };
    });
  });

  const scale = $derived((size / Math.min(width, height)) * view.zoom);
  const W = $derived(width * scale);
  const H = $derived(height * scale);

  const apply = (next: CropView) => {
    view = next;
    crop = cropOf(frame, view);
    placed = { ...crop };
  };

  const at = (sample: { x: number; y: number }): CropPoint => {
    const rect = host!.getBoundingClientRect();
    return { x: sample.x - rect.left, y: sample.y - rect.top };
  };

  const pointers = new SvelteMap<number, CropPoint>();
  let pinch: null | { zoom: number; distance: number } = null;

  let last: CropPoint | null = null;

  const abandonPan = (pointerId?: number) => {
    if (pointerId !== undefined) {
      pointers.delete(pointerId);
      if (pointers.size > 0) {
        if (pointers.size < 2) pinch = null;
        last = [...pointers.values()][0] ?? null;
        dragging = true;
        return;
      }
    }
    pointers.clear();
    pinch = null;
    last = null;
    dragging = false;
  };

  const pan: Grip = {
    get holding() {
      return dragging;
    },
    press(sample: PointerSample) {
      if (readonly || !sample.isPrimary || sample.button !== 0) return false;
      last = at(sample);
      dragging = true;
      return true;
    },
    move(sample) {
      if (readonly) return abandonPan();
      if (!pointers.has(sample.pointerId)) return;
      if (rightButtonDown(sample.buttons)) return abandonPan(sample.pointerId);
      const point = at(sample);
      const previous = last;
      last = point;
      if (!previous || pointers.size >= 2) return;
      apply(panCrop(frame, view, point.x - previous.x, point.y - previous.y));
    },
    release(sample) {
      pointers.delete(sample.pointerId);
      if (pointers.size < 2) pinch = null;
      last = [...pointers.values()][0] ?? null;
      dragging = pointers.size > 0;
    },
    abandon: abandonPan,
    click() {
      return false;
    },
  };
  const panAttach = attachGrip(pan);

  const touchPoint = (event: PointerEvent): CropPoint => at(event);

  const onpointerdown = (event: PointerEvent) => {
    if (readonly) return;
    host?.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, touchPoint(event));
    dragging = true;
    if (pointers.size === 2) startPinch();
  };

  const onpointermove = (event: PointerEvent) => {
    if (readonly) {
      abandonPan();
      return;
    }
    if (!pointers.has(event.pointerId)) return;
    if (rightButtonDown(event.buttons)) {
      abandonPan(event.pointerId);
      return;
    }
    const point = touchPoint(event);
    pointers.set(event.pointerId, point);
    if (pointers.size < 2) return;
    if (!pinch) startPinch();
    if (!pinch) return;
    const [a, b] = [...pointers.values()];
    if (!a || !b) return;
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    apply(pinchCrop(frame, view, pinch.zoom, pinch.distance, distance, middle));
  };

  const onpointerup = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    const [first] = [...pointers.values()];
    last = first ?? null;
    dragging = pointers.size > 0;
  };

  const startPinch = () => {
    const [a, b] = [...pointers.values()];
    if (!a || !b) return;
    pinch = {
      zoom: view.zoom,
      distance: Math.hypot(a.x - b.x, a.y - b.y),
    };
  };

  const onwheel = (event: WheelEvent) => {
    if (readonly) return;
    event.preventDefault();
    apply(wheelCrop(frame, view, event.deltaY, at(event)));
  };

  const onkeydown = (event: KeyboardEvent) => {
    if (readonly) return;
    const next = nudgeCrop(frame, view, event.key, event.shiftKey);
    if (!next) return;
    event.preventDefault();
    apply(next);
  };
</script>

<div class="flex flex-col items-center gap-3">
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    bind:this={host}
    class={[
      'crop relative overflow-hidden rounded-xl bg-primary-100',
      readonly ? 'is-readonly' : '',
    ]}
    style:width="{size}px"
    style:height="{size}px"
    role={readonly ? 'img' : 'application'}
    aria-label={readonly
      ? '取景框里的封面预览'
      : '调整封面的取景：拖动移动，捏合或滚轮缩放，方向键微调'}
    tabindex={readonly ? undefined : 0}
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onpointercancel={onpointerup}
    onlostpointercapture={onpointerup}
    {onwheel}
    {onkeydown}
    {@attach panAttach}
  >
    <img
      {src}
      alt=""
      draggable="false"
      class="pointer-events-none absolute left-0 top-0 max-w-none select-none"
      style:width="{W}px"
      style:height="{H}px"
      style:transform="translate3d({view.x}px, {view.y}px, 0)"
    />
    <div
      class={[
        'frame pointer-events-none absolute inset-0 rounded-lg',
        dragging && 'is-dragging',
      ]}
      aria-hidden="true"
    >
      <span class="third v1"></span><span class="third v2"></span><span
        class="third h1"
      ></span><span class="third h2"></span>
    </div>
  </div>
  {#if !readonly}
    <div class="max-w-80 w-full flex items-center gap-2 text-neutral-600">
      <IconButton
        icon={ZoomOut}
        label="缩小"
        onclick={() => apply(zoomBy(frame, view, 1 / 1.2))}
      />
      <input
        type="range"
        class="min-w-0 flex-1"
        min="1"
        max={maxZoomOf(frame)}
        step="0.01"
        value={view.zoom}
        aria-label="缩放"
        disabled={maxZoomOf(frame) <= 1}
        oninput={(event) =>
          apply(zoomTo(frame, view, Number(event.currentTarget.value)))}
      />
      <IconButton
        icon={ZoomIn}
        label="放大"
        onclick={() => apply(zoomBy(frame, view, 1.2))}
      />
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

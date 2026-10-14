<!--
  播放页的波浪进度条（DESIGN.md Wave Progress）：已播放的部分是一条缓缓起伏的正弦线（茎绿，3px），未播放的部分是一条平的发丝线；
  游标是 4×18px 的深薄荷圆角竖条，下面两端是等宽数字的时间。只在播放时流动，暂停时压平成小振幅；减少动态效果时不流动。
  真正的滑块：拖动、点按跳转，←/→ 快退快进 5 秒，Home / End 跳到头尾。touch：手机上点按区域更高
-->
<script lang='ts'>
  import type { Playhead } from './playhead.svelte'
  import { getAppView } from '../app-context.svelte'
  import { formatSeconds, shownDuration } from './view'

  const { playhead, touch = false }: { playhead: Playhead, touch?: boolean } = $props()

  /** 一个起伏的长度、线所在的高度（px） */
  const WAVELENGTH = 24
  const MIDDLE = 12
  /** ←/→ 一次跳几秒 */
  const STEP = 5

  const uid = $props.id()
  const view = getAppView()
  const player = $derived(view.state.player)
  const duration = $derived(shownDuration(player))
  const live = $derived(player.status === 'playing')

  let width = $state(0)
  let track = $state<HTMLElement>()
  /** 拖动中游标在哪（0 到 1）；没在拖时是 null */
  let dragging = $state<number | null>(null)

  const ratio = $derived(dragging ?? (duration > 0 ? Math.min(1, playhead.now / duration) : 0))
  const x = $derived(ratio * width)
  const shownTime = $derived(ratio * duration)

  /** 比整条线两头各多一个波长，流动时两端不露空 */
  const wavePath = $derived.by(() => {
    const half = WAVELENGTH / 2
    let path = `M ${-WAVELENGTH} ${MIDDLE} q ${half / 2} -7 ${half} 0`
    for (let at = -WAVELENGTH + half; at < width + WAVELENGTH; at += half)
      path += ` t ${half} 0`
    return path
  })

  function ratioAt(clientX: number): number {
    const rect = track!.getBoundingClientRect()
    return rect.width > 0 ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0
  }

  function onpointerdown(event: PointerEvent) {
    if (duration <= 0 || event.button !== 0)
      return
    track!.setPointerCapture(event.pointerId)
    dragging = ratioAt(event.clientX)
  }

  function onpointermove(event: PointerEvent) {
    if (dragging !== null)
      dragging = ratioAt(event.clientX)
  }

  function onpointerup() {
    if (dragging === null)
      return
    view.app.seek(dragging * duration)
    dragging = null
  }

  function onkeydown(event: KeyboardEvent) {
    if (duration <= 0)
      return
    const at = player.position
    const to = {
      ArrowRight: at + STEP,
      ArrowUp: at + STEP,
      ArrowLeft: at - STEP,
      ArrowDown: at - STEP,
      Home: 0,
      End: duration,
    }[event.key]
    if (to === undefined)
      return
    event.preventDefault()
    view.app.seek(to)
  }
</script>

<div class={['wave', touch && 'touch']}>
  <div
    bind:this={track}
    bind:clientWidth={width}
    class='track'
    role='slider'
    tabindex='0'
    aria-label='播放进度'
    aria-valuemin={0}
    aria-valuemax={Math.round(duration)}
    aria-valuenow={Math.round(shownTime)}
    aria-valuetext='{formatSeconds(shownTime)} / {formatSeconds(duration)}'
    aria-disabled={duration <= 0}
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onpointercancel={() => (dragging = null)}
    {onkeydown}
  >
    {#if width > 0}
      <svg {width} height='24' viewBox='0 0 {width} 24' aria-hidden='true'>
        <defs>
          <!-- 从线的左端（时间的左边缘）起，到游标前 6px：流动的波浪不伸出进度条 -->
          <clipPath id='{uid}-played'>
            <rect x='0' y='0' width={Math.max(0, x - 6)} height='24' />
          </clipPath>
        </defs>
        <line class='rest' x1={Math.min(width, x + 6)} y1={MIDDLE} x2={width} y2={MIDDLE} />
        <g clip-path='url(#{uid}-played)'>
          <g class={['amplitude', live && dragging === null && 'live']}>
            <path class='flow' d={wavePath} />
          </g>
        </g>
        <rect class='thumb' x={x - 2} y='3' width='4' height='18' rx='2' />
      </svg>
    {/if}
  </div>
  <div class='times text-caption text-neutral-700 tabular-nums' aria-hidden='true'>
    <span>{formatSeconds(shownTime)}</span>
    <span>{formatSeconds(duration)}</span>
  </div>
</div>

<style>
  .track {
    display: flex;
    align-items: center;
    height: 32px;
    cursor: pointer;
    touch-action: none;
    border-radius: 8px;
  }

  .track[aria-disabled='true'] {
    cursor: default;
  }

  .touch .track {
    height: 44px;
  }

  svg {
    display: block;
    overflow: visible;
  }

  .rest {
    stroke: theme('colors.neutral.200');
    stroke-width: 2.5;
    stroke-linecap: round;
  }

  .amplitude {
    transform-origin: 0 12px;
    transform: scaleY(0.25);
    transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .amplitude.live {
    transform: scaleY(1);
  }

  .flow {
    fill: none;
    stroke: theme('colors.primary.800');
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
    animation: flow 1.8s linear infinite;
    animation-play-state: paused;
  }

  .live .flow {
    animation-play-state: running;
  }

  .thumb {
    fill: theme('colors.primary.900');
  }

  .times {
    display: flex;
    justify-content: space-between;
    margin-top: 2px;
  }

  .touch .times {
    margin-top: -4px;
  }

  @media (prefers-reduced-motion: reduce) {
    .flow {
      animation: none;
    }

    .amplitude {
      transition: none;
    }
  }

  @keyframes flow {
    from {
      transform: translateX(0);
    }

    to {
      transform: translateX(24px);
    }
  }
</style>

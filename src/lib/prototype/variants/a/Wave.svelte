<!--
  PROTOTYPE：播放页的波浪进度条。已播放的部分是一条缓缓起伏的正弦线（只在播放时流动），未播放的部分是一条平的细线。
  真正的滑块：拖动、点按跳转，←/→ ±5 秒，Home/End。
-->
<script lang='ts'>
  import { formatDuration } from '$lib/prototype/data'
  import { player } from '$lib/prototype/player.svelte'

  interface Props {
    /** 触屏尺寸：更高的点按区域、更大的时间字号 */
    touch?: boolean
  }

  const { touch = false }: Props = $props()

  const uid = $props.id()
  const WAVELENGTH = 24
  const MID = 12

  let width = $state(0)
  let dragRatio = $state<number | null>(null)
  let track = $state<HTMLElement>()

  const duration = $derived(player.current?.duration ?? 0)
  const ratio = $derived(dragRatio ?? (duration ? Math.min(1, player.position / duration) : 0))
  const x = $derived(ratio * width)
  const shownTime = $derived(ratio * duration)

  const wavePath = $derived.by(() => {
    const half = WAVELENGTH / 2
    let d = `M ${-WAVELENGTH} ${MID} q ${half / 2} -7 ${half} 0`
    for (let at = -WAVELENGTH + half; at < width + WAVELENGTH; at += half)
      d += ` t ${half} 0`
    return d
  })

  function ratioAt(clientX: number): number {
    if (!track)
      return 0
    const rect = track.getBoundingClientRect()
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  }

  function onpointerdown(e: PointerEvent) {
    if (!duration)
      return
    track?.setPointerCapture(e.pointerId)
    dragRatio = ratioAt(e.clientX)
  }

  function onpointermove(e: PointerEvent) {
    if (dragRatio !== null)
      dragRatio = ratioAt(e.clientX)
  }

  function onpointerup() {
    if (dragRatio === null)
      return
    player.seek(dragRatio * duration)
    dragRatio = null
  }

  function onkeydown(e: KeyboardEvent) {
    const at = player.position
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp')
      player.seek(at + 5)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown')
      player.seek(at - 5)
    else if (e.key === 'Home')
      player.seek(0)
    else if (e.key === 'End')
      player.seek(duration)
    else return
    e.preventDefault()
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
    aria-valuetext='{formatDuration(shownTime)} / {formatDuration(duration)}'
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onpointercancel={() => (dragRatio = null)}
    {onkeydown}
  >
    {#if width > 0}
      <svg {width} height='24' viewBox='0 0 {width} 24' aria-hidden='true'>
        <defs>
          <clipPath id='{uid}-played'>
            <rect x='-2' y='0' width={Math.max(0, x - 6)} height='24' />
          </clipPath>
        </defs>
        <line class='rest' x1={Math.min(width, x + 6)} y1={MID} x2={width} y2={MID} />
        <g clip-path='url(#{uid}-played)'>
          <g class={['amp', player.playing && 'live']}>
            <path class='flow' d={wavePath} />
          </g>
        </g>
        <rect class='thumb' x={x - 2} y='3' width='4' height='18' rx='2' />
      </svg>
    {/if}
  </div>
  <div class='times tnum'>
    <span>{formatDuration(shownTime)}</span>
    <span>{formatDuration(duration)}</span>
  </div>
</div>

<style>
  .wave {
    width: 100%;
  }

  .track {
    display: flex;
    align-items: center;
    height: 32px;
    cursor: pointer;
    touch-action: none;
    border-radius: 8px;
  }

  .touch .track {
    height: 44px;
  }

  svg {
    display: block;
    overflow: visible;
  }

  .rest {
    stroke: #e5e7eb;
    stroke-width: 2.5;
    stroke-linecap: round;
  }

  .amp {
    transform-origin: 0 12px;
    transform: scaleY(0.25);
    transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .amp.live {
    transform: scaleY(1);
  }

  .flow {
    fill: none;
    stroke: #2b976f;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
    animation: flow 1.8s linear infinite;
  }

  .amp:not(.live) .flow {
    animation-play-state: paused;
  }

  .thumb {
    fill: #206f52;
  }

  .times {
    display: flex;
    justify-content: space-between;
    margin-top: 2px;
    font-size: 12.5px;
    line-height: 16px;
    color: #4b5563;
  }

  .touch .times {
    margin-top: -2px;
    font-size: 13px;
  }

  @media (prefers-reduced-motion: reduce) {
    .flow {
      animation: none;
    }

    .amp {
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

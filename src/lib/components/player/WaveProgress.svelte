<!--
  播放页的波浪进度条（DESIGN.md Wave Progress）：已播放的部分是一条缓缓起伏的正弦线（茎绿，3px），未播放的部分是一条平的发丝线；
  游标是 4×18px 的深薄荷圆角竖条，下面两端是等宽数字的时间。只在播放时起伏、流动；暂停（和拖动游标）时马上抹平成一条直线（160ms），
  再播放时 420ms 里渐渐起伏回来。抹平改的是起伏的高度，线一直是 3px 粗。减少动态效果时不流动，起伏直接切换。
  换歌时已播放的部分用 200ms 收回起点（DESIGN.md Cover Wheel），不是一下跳回去。
  真正的滑块（seek-slider.svelte.ts）：拖动、点按跳转，←/→ 快退快进 5 秒，Home / End 跳到头尾。touch：手机上点按区域更高
-->
<script lang='ts'>
  import type { Playhead } from './playhead.svelte'
  import { untrack } from 'svelte'
  import { cubicOut } from 'svelte/easing'
  import { Tween } from 'svelte/motion'
  import { getAppView } from '../shared/app-context.svelte'
  import { easeOutSoft, moveMs } from '../shared/motion'
  import { DURATIONS } from '../shared/motion-tokens'
  import { currentSong } from './now'
  import { createSeekSlider } from './seek-slider.svelte'
  import { formatSeconds } from './view'

  const { playhead, touch = false }: { playhead: Playhead, touch?: boolean } = $props()

  /** 一个起伏的长度、线所在的高度、起伏的高度（px） */
  const WAVELENGTH = 24
  const MIDDLE = 12
  const AMPLITUDE = 7

  const uid = $props.id()
  const view = getAppView()
  const slider = createSeekSlider()
  const live = $derived(view.state.player.status === 'playing')

  let width = $state(0)

  const ratio = $derived(slider.ratio(playhead.now))
  const shownTime = $derived(ratio * slider.duration)
  const waving = $derived(live && slider.dragging === null)

  /**
   * 换歌时已播放的部分从原来画到的地方收回起点：游标画在 ratio 和它之间靠后的那个（占整条的比例），它 200ms 里收到 0。
   * 取靠后的那个：换歌和进度回到 0 不一定在同一次更新里到，先到哪个都不会一下跳回去
   */
  const drain = new Tween(0, { easing: easeOutSoft })
  const shown = $derived(Math.max(ratio, drain.current))
  const songId = $derived(currentSong(view.state.player)?.id)
  // 上一帧画的是哪首、画到哪：换歌的那一刻从这里收回来
  let lastSong = untrack(() => songId)
  let lastShown = untrack(() => shown)
  $effect(() => {
    if (songId !== lastSong) {
      void drain.set(lastShown, { duration: 0 })
      void drain.set(0, { duration: moveMs(DURATIONS.state) })
    }
    lastSong = songId
    lastShown = shown
  })
  const x = $derived(shown * width)

  /** 起伏的高度：暂停时马上抹平，播放时渐渐起来；一打开就是当前的样子，不从平的长出来 */
  const amplitude = Tween.of(() => waving ? AMPLITUDE : 0, {
    duration: (_, to) => moveMs(to === 0 ? DURATIONS['wave-flatten'] : DURATIONS['wave-rise']),
    easing: cubicOut,
  })

  /** 比整条线两头各多一个波长，流动时两端不露空 */
  const wavePath = $derived.by(() => {
    const half = WAVELENGTH / 2
    let path = `M ${-WAVELENGTH} ${MIDDLE} q ${half / 2} ${-amplitude.current} ${half} 0`
    for (let at = -WAVELENGTH + half; at < width + WAVELENGTH; at += half)
      path += ` t ${half} 0`
    return path
  })
</script>

<div class={['wave', touch && 'touch']}>
  <div bind:clientWidth={width} class='track' {...slider.attributes(ratio)} {@attach slider.attach}>
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
          <path class={['flow', waving && 'live']} d={wavePath} />
        </g>
        <rect class='thumb' x={x - 2} y='3' width='4' height='18' rx='2' />
      </svg>
    {/if}
  </div>
  <div class='times text-caption text-neutral-700 tabular-nums' aria-hidden='true'>
    <span>{formatSeconds(shownTime)}</span>
    <span>{formatSeconds(slider.duration)}</span>
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

  .flow {
    fill: none;
    stroke: theme('colors.primary.800');
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
    animation: flow var(--loop-wave-flow) linear infinite;
    animation-play-state: paused;
  }

  .flow.live {
    animation-play-state: var(--loop-state);
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

  @keyframes flow {
    from {
      transform: translateX(0);
    }

    to {
      transform: translateX(24px);
    }
  }
</style>

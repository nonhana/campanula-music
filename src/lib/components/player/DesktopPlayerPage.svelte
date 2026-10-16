<!--
  桌面播放页（DESIGN.md Layout · 播放页，原型 DesktopPlayer）：顶上收起键和“正在播放 · 来自「…」”，正中一个拖动把手
  （按住往下拖，过了阈值松手就收起，不到就弹回；点按也收起）；
  左列封面、歌名、波浪进度条、循环 / 上一首 / 播放 / 下一首 / 随机播放、音量；右列在 歌词 / 播放队列 之间切换（←/→ 换标签）：
  两块并排放在一条轨道上、一直挂着，换标签时轨道和指示块一起横着滑，看不见的那块 Tab 不到、读屏读不到。
  整页放进视口，不滚动。换歌时封面换碟（CoverWheel），转出左列的部分淡掉，不压到歌词。
  红心（#30）和“更多”菜单（等有了加入歌单、查看歌手这类对当前这首有用的项）由之后的票加。放在 PlayerPage 里
-->
<script lang='ts'>
  import type { Song } from '$lib/api/library'
  import type { Playhead } from './playhead.svelte'
  import type { Turn } from './view'
  import { ChevronDown } from '@lucide/svelte'
  import { langOf } from '../library/view'
  import { DURATIONS } from '../motion-tokens'
  import IconButton from '../ui/IconButton.svelte'
  import CoverWheel from './CoverWheel.svelte'
  import Lyrics from './Lyrics.svelte'
  import NowPlayingTitle from './NowPlayingTitle.svelte'
  import PlayButton from './PlayButton.svelte'
  import { playerPageChoices as choices, closePlayerPage, playerDrawer } from './player-page.svelte'
  import PlayModeButton from './PlayModeButton.svelte'
  import QueueList from './QueueList.svelte'
  import SkipButton from './SkipButton.svelte'
  import { PAGE_COVER } from './view'
  import VolumeControl from './VolumeControl.svelte'
  import WaveProgress from './WaveProgress.svelte'

  const { song, source, playhead, turn }: { song: Song, source: string | null, playhead: Playhead, turn: Turn | null } = $props()

  const PANELS = [
    { key: 'lyrics', label: '歌词' },
    { key: 'queue', label: '播放队列' },
  ] as const

  const uid = $props.id()
  const gripHandle = playerDrawer.grip({ from: 'open', commit: closePlayerPage, tap: closePlayerPage })

  /** 标签之间用 ←/→ 切换（WAI-ARIA 标签页的做法），焦点跟着走 */
  function onTabKey(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
      return
    event.preventDefault()
    choices.panel = choices.panel === 'lyrics' ? 'queue' : 'lyrics'
    document.getElementById(`${uid}-${choices.panel}-tab`)?.focus()
  }
</script>

<header class='relative h-16 flex flex-none items-center gap-3 px-6'>
  <IconButton icon={ChevronDown} label='收起播放页' title='收起（Esc）' onclick={closePlayerPage} />
  <p class='min-w-0 truncate text-label text-neutral-700'>
    <span class='text-neutral-900 font-500'>正在播放</span>{#if source}<span class='mx-1.5' aria-hidden='true'>·</span>来自「<span lang={langOf(source)}>{source}</span>」{/if}
  </p>
  <!-- 给鼠标用的把手：键盘用旁边的收起键和 Esc，所以不进 Tab 顺序（和遮罩一样） -->
  <button
    type='button'
    class='group absolute left-1/2 top-1 grid h-6 w-40 cursor-grab place-items-center rounded-full -translate-x-1/2'
    aria-label='拖动把手：往下拖或点按，收起播放页'
    title='往下拖或点按，收起播放页'
    tabindex='-1'
    {@attach gripHandle}
  >
    <span class='h-1 w-10 rounded-full bg-neutral-400 transition-colors duration-feedback mouse:group-hover:bg-neutral-600' aria-hidden='true'></span>
  </button>
</header>

<!-- 窄于 1024px 时两栏按比例分，右栏的歌词不至于挤成一两个字一行。栏间距写在 --gap 上，换碟的遮罩按它算 -->
<div class='columns relative grid grid-cols-[minmax(240px,1fr)_minmax(0,1.15fr)] mx-auto max-w-[1240px] min-h-0 w-full flex-1 px-8 pb-8 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] lg:px-12'>
  <section class='min-h-0 flex flex-col justify-center' aria-label='播放控制'>
    <div class='stage'>
      <div class='cover mx-auto'>
        <CoverWheel {song} {turn} duration={DURATIONS.focal} size={PAGE_COVER.desktop} fluid eager class='rounded-xl shadow-float' />
      </div>
    </div>

    <div class='mt-6'>
      <NowPlayingTitle {song} {turn} />
    </div>

    <div class='mt-3'>
      <WaveProgress {playhead} />
    </div>

    <div class='mt-3 flex items-center justify-between'>
      <PlayModeButton kind='repeat' />
      <div class='flex items-center gap-2 lg:gap-4'>
        <SkipButton direction='previous' />
        <PlayButton size={64} />
        <SkipButton direction='next' />
      </div>
      <PlayModeButton kind='shuffle' />
    </div>

    <div class='mt-4 flex items-center gap-2 -ml-2.5'>
      <VolumeControl class='flex-1' />
    </div>
  </section>

  <section class='min-h-0 flex flex-col' aria-label='歌词和播放队列'>
    <div class='relative grid grid-cols-2 flex-none self-start rounded-full bg-white/70 p-1 shadow-ambient' role='tablist' aria-label='右栏显示'>
      <span class='indicator absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-primary-200' style:transform={choices.panel === 'queue' ? 'translateX(100%)' : 'none'} aria-hidden='true'></span>
      {#each PANELS as panel (panel.key)}
        {@const selected = choices.panel === panel.key}
        <button
          type='button'
          id='{uid}-{panel.key}-tab'
          role='tab'
          aria-selected={selected}
          aria-controls='{uid}-{panel.key}'
          tabindex={selected ? 0 : -1}
          class={['relative h-9 w-28 rounded-full text-label font-500 transition-colors duration-state', selected ? 'text-primary-950' : 'text-neutral-700 mouse:hover:text-neutral-900']}
          onclick={() => (choices.panel = panel.key)}
          onkeydown={onTabKey}
        >{panel.label}</button>
      {/each}
    </div>

    <!-- 歌词、播放队列并排放在一条轨道上，两块都一直挂着（歌词的滚动位置不丢），换标签时和指示块一起横着滑；看不见的那块 inert -->
    <div class='track mt-5 min-h-0 flex-1' style:--shown={PANELS.findIndex(panel => panel.key === choices.panel)}>
      {#each PANELS as panel, index (panel.key)}
        {@const selected = choices.panel === panel.key}
        <div id='{uid}-{panel.key}' role='tabpanel' aria-labelledby='{uid}-{panel.key}-tab' class={['slide min-h-0 flex flex-col', !selected && 'away']} style:--slot={index} inert={!selected}>
          {#if panel.key === 'queue'}
            <div class='min-h-0 flex flex-1 flex-col rounded-xl bg-white shadow-ambient'>
              <QueueList class='flex-1' />
            </div>
          {:else}
            <Lyrics {song} {playhead} class='flex-1' />
          {/if}
        </div>
      {/each}
    </div>
  </section>
</div>

<style>
  /* 换碟只在左列里转：遮罩从左列两边各伸出半个栏间距，伸出的这一截里渐渐淡掉，转出去的封面碰不到歌词。
     上下多留出地方，转开的封面往下沉、封面的阴影都不被裁掉；它不接点按，盖着下面的歌名、进度条也不碍事 */
  .columns {
    --gap: 40px;

    column-gap: var(--gap);
  }

  @media (min-width: 1024px) {
    .columns {
      --gap: 80px;
    }
  }

  .stage {
    --bleed: calc(var(--gap) / 2);
    --rise: 48px;
    --sink: 50%;

    margin: calc(-1 * var(--rise)) calc(-1 * var(--bleed)) calc(-1 * var(--sink));
    padding: var(--rise) var(--bleed) var(--sink);
    mask-image: linear-gradient(to right, transparent, #000 var(--bleed), #000 calc(100% - var(--bleed)), transparent);
    pointer-events: none;
  }

  /* 封面不能把下面的控制键挤出视口：视口矮时跟着缩 */
  .cover {
    width: 100%;
    max-width: min(420px, calc(100dvh - 440px));
  }

  .indicator {
    transition: transform var(--move-panel) var(--ease-out-soft);
  }

  /* 右栏的轨道：两块叠在同一格里，各自按离显示的那块隔几格横着摆（一格是自己的宽度再加 --track-gap），和指示块一起滑（面板 360ms）。
     左右各多留 --bleed 再裁掉，歌词行的焦点环、播放队列面板的阴影不被切掉；两块隔得比两倍 --bleed 宽，看不见的那块不露边。
     看不见的那块是透明的：减少动态效果时轨道不滑（--move-* 是 0），换成原地交叉淡化（最多 150ms）。
     下面两处时长、延迟用 --duration-* 减去 --move-*：正常时是 0，整条轨道不透明地滑；减少动态效果时就是淡入淡出的时长 */
  .track {
    --bleed: 16px;
    --track-gap: 48px;

    display: grid;
    grid-template: minmax(0, 1fr) / minmax(0, 1fr);
    margin-inline: calc(-1 * var(--bleed));
    padding-inline: var(--bleed);
    overflow-x: clip;
  }

  /* 进来的：正常时一下变不透明再滑进来；减少动态效果时在原地淡入 */
  .slide {
    grid-area: 1 / 1;
    translate: calc((var(--slot) - var(--shown)) * (100% + var(--track-gap)));
    transition:
      translate var(--move-panel) var(--ease-out-soft),
      opacity calc(var(--duration-panel) - var(--move-panel)) var(--ease-out-soft);
  }

  /* 出去的：正常时滑出去以后才变透明；减少动态效果时先在原地淡出，淡完再挪开 */
  .slide.away {
    opacity: 0;
    transition:
      translate var(--move-panel) var(--ease-out-soft) calc(var(--duration-panel-out) - var(--move-panel-out)),
      opacity var(--duration-panel-out) var(--ease-in-soft) var(--move-panel);
  }
</style>

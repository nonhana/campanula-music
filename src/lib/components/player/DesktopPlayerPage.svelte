<!--
  桌面播放页（DESIGN.md Layout · 播放页，原型 DesktopPlayer）：顶上收起键和“正在播放 · 来自「…」”，正中一个拖动把手
  （按住往下拖，过了阈值松手就收起，不到就弹回；点按也收起）；
  左列封面、歌名、波浪进度条、上一首 / 播放 / 下一首、音量；右列在 歌词 / 播放队列 之间切换（←/→ 换标签）。整页放进视口，不滚动。
  红心（#30）、“更多”菜单和播放模式（#26）由之后的票加。放在 PlayerPage 里
-->
<script lang='ts'>
  import type { Song } from '$lib/api/library'
  import type { Playhead } from './playhead.svelte'
  import { ChevronDown } from '@lucide/svelte'
  import Cover from '../library/Cover.svelte'
  import { langOf } from '../library/view'
  import IconButton from '../ui/IconButton.svelte'
  import Lyrics from './Lyrics.svelte'
  import NowPlayingTitle from './NowPlayingTitle.svelte'
  import PlayButton from './PlayButton.svelte'
  import { playerPageChoices as choices, closePlayerPage, playerDrawer } from './player-page.svelte'
  import QueueList from './QueueList.svelte'
  import SkipButton from './SkipButton.svelte'
  import VolumeControl from './VolumeControl.svelte'
  import WaveProgress from './WaveProgress.svelte'

  const { song, source, playhead }: { song: Song, source: string | null, playhead: Playhead } = $props()

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
    <span class='h-1 w-10 rounded-full bg-neutral-400 transition-colors duration-150 mouse:group-hover:bg-neutral-600' aria-hidden='true'></span>
  </button>
</header>

<!-- 窄于 1024px 时两栏按比例分，右栏的歌词不至于挤成一两个字一行 -->
<div class='relative grid grid-cols-[minmax(240px,1fr)_minmax(0,1.15fr)] mx-auto max-w-[1240px] min-h-0 w-full flex-1 gap-x-10 px-8 pb-8 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] lg:gap-x-20 lg:px-12'>
  <section class='min-h-0 flex flex-col justify-center' aria-label='播放控制'>
    <div class='cover self-center'>
      <Cover url={song.album.coverUrl} size={420} fluid eager class='rounded-xl shadow-float' />
    </div>

    <div class='mt-6'>
      <NowPlayingTitle {song} />
    </div>

    <div class='mt-3'>
      <WaveProgress {playhead} />
    </div>

    <div class='mt-3 flex items-center justify-center gap-4'>
      <SkipButton direction='previous' />
      <PlayButton size={64} />
      <SkipButton direction='next' />
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
          aria-controls='{uid}-panel'
          tabindex={selected ? 0 : -1}
          class={['relative h-9 w-28 rounded-full text-label font-500 transition-colors duration-200 motion-reduce:transition-none', selected ? 'text-primary-950' : 'text-neutral-700 mouse:hover:text-neutral-900']}
          onclick={() => (choices.panel = panel.key)}
          onkeydown={onTabKey}
        >{panel.label}</button>
      {/each}
    </div>

    <div id='{uid}-panel' role='tabpanel' aria-labelledby='{uid}-{choices.panel}-tab' class='mt-5 min-h-0 flex flex-1 flex-col'>
      {#if choices.panel === 'queue'}
        <div class='min-h-0 flex flex-1 flex-col rounded-xl bg-white shadow-ambient'>
          <QueueList class='flex-1' />
        </div>
      {:else}
        <Lyrics {song} {playhead} class='flex-1' />
      {/if}
    </div>
  </section>
</div>

<style>
  /* 封面不能把下面的控制键挤出视口：视口矮时跟着缩 */
  .cover {
    width: 100%;
    max-width: min(420px, calc(100dvh - 440px));
  }

  .indicator {
    transition: transform 360ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  @media (prefers-reduced-motion: reduce) {
    .indicator {
      transition: none;
    }
  }
</style>

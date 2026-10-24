<!--
  手机播放页（DESIGN.md Layout · 播放页，照 Auxio 结构，原型 PhonePlayer），一屏放下、不滚动：顶上收起键、来源、歌词键；中间封面按歌词键或点按换成歌词，
  按住封面左右拖切歌（cover-swipe.svelte.ts、CoverWheel），读屏和键盘用下面的上一首 / 下一首。下面左对齐歌名、歌手、专辑（右边红心和“更多”），
  波浪进度条，循环 / 上一首 / 播放 / 下一首 / 随机；最底“播放队列”点开或上拖拉开底部弹层，弹层按自身高度滑进滑出，拉手下拉、点按收起（返回先收它）。
  换歌时封面换碟，转出屏幕的部分裁掉；“更多”和歌曲行里同一份（#38 可下载当前这首），播放来源是这首歌自己的。放在 PlayerPage 里。
-->
<script lang='ts'>
  import { ChevronDown, MicVocal } from '@lucide/svelte'

  import type { Song } from '#lib/api/library.js'

  import { getOverlays } from '../overlay/overlay-context'
  import { getAppView } from '../shared/app-context.svelte'
  import { fade, float, recede } from '../shared/motion'
  import { DURATIONS, FLOAT_IN_DELAY, PAGE_DISTANCE } from '../shared/motion-tokens'
  import { langOf } from '../shared/text'
  import HeartButton from '../songs/HeartButton.svelte'
  import SongMoreButton from '../songs/SongMoreButton.svelte'
  import { createCoverSwipe } from './cover-swipe.svelte'
  import CoverWheel from './CoverWheel.svelte'
  import { createDrawer } from './drawer.svelte'
  import Lyrics from './Lyrics.svelte'
  import NowPlayingTitle from './NowPlayingTitle.svelte'
  import PlayButton from './PlayButton.svelte'
  import { playerPageChoices as choices, playerPageActions } from './player-page.svelte'
  import type { Playhead } from './playhead.svelte'
  import PlayModeButton from './PlayModeButton.svelte'
  import QueueList from './QueueList.svelte'
  import SkipButton from './SkipButton.svelte'
  import type { Turn } from './view'
  import { neighborSong, PAGE_COVER } from './view'
  import WaveProgress from './WaveProgress.svelte'

  const { song, source, playhead, turn }: { song: Song, source: string | null, playhead: Playhead, turn: Turn | null } = $props()

  const view = getAppView()
  const { player, queue, playerDrawer } = getOverlays()
  const { closePlayerPage, closeQueueSheet, openQueueSheet } = playerPageActions()
  const queueOpen = $derived(queue.request !== null)
  /** 拖封面时从左边、右边转进来的上一首、下一首 */
  const previous = $derived(neighborSong(view.state.player, 'previous'))
  const next = $derived(neighborSong(view.state.player, 'next'))
  /** 当前这首在播放队列里的那一项：“更多”菜单里放进播放队列时用它自己的播放来源 */
  const entry = $derived(view.state.player.current === null
    ? null
    : view.state.player.queue[view.state.player.current])

  /** 左右拖封面切歌；轻点封面换成歌词 */
  const swipe = createCoverSwipe({
    current: () => song.id,
    has: direction => view.state.player.neighbors[direction] !== null,
    commit: direction => view.app[direction](),
    tap: () => (choices.phoneLyrics = true),
  })

  /** 播放队列弹层占屏幕高度的这么多 */
  const SHEET_HEIGHT = 0.86

  let sheet = $state<HTMLElement>()

  /** 播放队列弹层：从底下的“播放队列”往上拖的头几帧它还没画出来，按屏幕高度的 86% 算 */
  const sheetDrawer = createDrawer(() => window.innerHeight * SHEET_HEIGHT)
  const gripTitle = playerDrawer.grip({ from: 'open', commit: closePlayerPage })
  const gripQueueBar = sheetDrawer.grip({ from: 'closed', commit: openQueueSheet, tap: openQueueSheet })
  const gripSheet = sheetDrawer.grip({ from: 'open', commit: closeQueueSheet, tap: closeQueueSheet })

  // 队列这一层的请求说拉开着就升起来，说收起就缩回去（返回、Esc、拉手、遮罩都走浮层栈）
  $effect(() => sheetDrawer.settle(queueOpen))

  // 拉开播放队列时焦点进弹层；收起时的焦点由浮层栈按队列入口那条按钮归还
  $effect(() => {
    if (!queueOpen)
      return
    sheet?.querySelector<HTMLElement>('button')?.focus()
  })
</script>

<div class='relative min-h-0 flex flex-1 flex-col' inert={player.inert}>
  <div class='relative grid grid-cols-[48px_minmax(0,1fr)_48px] h-16 flex-none items-center px-1'>
    <button type='button' class='grid size-12 place-items-center rounded-full text-neutral-800 active:bg-white/60' aria-label='收起播放页' onclick={closePlayerPage}>
      <ChevronDown size={26} aria-hidden='true' />
    </button>
    <div class='min-w-0 text-center' {@attach gripTitle}>
      <p class='text-body text-neutral-900 font-500'>正在播放</p>
      {#if source}
        <p class='truncate text-caption text-neutral-700' transition:fade>来自「<span lang={langOf(source)}>{source}</span>」</p>
      {/if}
    </div>
    <button
      type='button'
      class={[
        'size-12 grid place-items-center rounded-full transition-colors duration-feedback',
        choices.phoneLyrics ? 'bg-primary-100 text-primary-950' : 'text-neutral-800 active:bg-white/60',
      ]}
      aria-label='歌词'
      aria-pressed={choices.phoneLyrics}
      onclick={() => (choices.phoneLyrics = !choices.phoneLyrics)}
    >
      <MicVocal size={22} aria-hidden='true' />
    </button>
  </div>

  <div class='relative min-h-0 flex flex-1 flex-col px-6 pb-3'>
    <!-- 封面和歌词轮流占这一块：换成歌词时封面缩到 96% 淡出，歌词从下面浮上来；换回反过来，歌词往下沉，封面放大回来 -->
    <div class='relative min-h-0 flex-1'>
      {#if choices.phoneLyrics}
        <div
          class='absolute inset-0 flex flex-col pt-1'
          in:float={{
            toward: 'up',
            distance: PAGE_DISTANCE.in,
            duration: DURATIONS.panel,
            delay: FLOAT_IN_DELAY,
          }}
          out:float={{ toward: 'down', distance: PAGE_DISTANCE.out, duration: DURATIONS['panel-out'] }}
        >
          <Lyrics {song} {playhead} compact class='min-h-0 flex-1' />
        </div>
      {:else}
        <div class='stage absolute inset-0 grid place-items-center' in:recede={{ delay: FLOAT_IN_DELAY }} out:recede>
          <button type='button' class='face rounded-xl' aria-label='显示歌词' {@attach swipe.grip}>
            <CoverWheel {song} {turn} duration={DURATIONS.focal} size={PAGE_COVER.phone} fluid eager class='rounded-xl shadow-float' drag={swipe.turned} {previous} {next} />
          </button>
        </div>
      {/if}
    </div>

    <div class='flex-none pt-5'>
      <div class='flex items-start gap-1'>
        <div class='min-w-0 flex-1'>
          <NowPlayingTitle {song} {turn} phone />
        </div>
        <HeartButton {song} size='phone-page' />
        {#if entry}<SongMoreButton song={entry.song} source={entry.source} size='phone-page' />{/if}
      </div>

      <div class='mt-2'>
        <WaveProgress {playhead} touch />
      </div>

      <div class='mt-3 flex items-center justify-between'>
        <PlayModeButton kind='repeat' phone />
        <div class='flex items-center gap-4'>
          <SkipButton direction='previous' phone />
          <PlayButton size={72} />
          <SkipButton direction='next' phone />
        </div>
        <PlayModeButton kind='shuffle' phone />
      </div>
    </div>
  </div>

  <button
    data-queue-entry
    type='button'
    class='relative h-14 flex flex-none flex-col items-center rounded-t-sheet bg-white/90 pt-2 shadow-float'
    aria-haspopup='dialog'
    aria-expanded={queueOpen}
    {@attach gripQueueBar}
  >
    <span class='h-1 w-9 rounded-full bg-neutral-300' aria-hidden='true'></span>
    <span class='mt-2 text-label text-neutral-800 font-500'>播放队列</span>
  </button>
</div>

{#if queueOpen || sheetDrawer.visible}
  <button type='button' class='fixed inset-0 z-1 bg-neutral-900/30' style:opacity={1 - sheetDrawer.position} aria-label='收起播放队列' tabindex='-1' onclick={closeQueueSheet}></button>
  <div
    bind:this={sheet}
    class='fixed inset-x-0 z-2 flex flex-col rounded-t-sheet bg-white shadow-float'
    style:top='{(1 - SHEET_HEIGHT) * 100}dvh'
    {@attach sheetDrawer.panel}
    role='dialog'
    aria-modal='true'
    aria-label='播放队列'
    inert={!queueOpen || queue.inert}
  >
    <button type='button' class='grid mx-auto h-7 w-16 flex-none place-items-center rounded-full' aria-label='收起播放队列' {@attach gripSheet}>
      <span class='h-1 w-9 rounded-full bg-neutral-300' aria-hidden='true'></span>
    </button>
    <QueueList class='min-h-0 flex-1' />
  </div>
{/if}

<style>
  .stage {
    container-type: size;
  }

  .face {
    width: min(100cqw, 100cqh);
    height: min(100cqw, 100cqh);
  }
</style>

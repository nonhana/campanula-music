<!--
  手机播放页（DESIGN.md Layout · 播放页，照 Auxio 的结构，原型 PhonePlayer），一屏放下、不滚动：
  顶上收起键、“正在播放 / 来自「…」”（按住往下拖也能收起播放页）、歌词键；中间一大块是封面，按歌词键或点封面换成歌词，再按换回；
  按住封面左右拖切到上一首 / 下一首，转盘跟着手转（cover-swipe.svelte.ts、CoverWheel）；读屏和键盘用下面的上一首、下一首按钮。
  下面左对齐的歌名、歌手、专辑，波浪进度条，循环 / 上一首 / 播放 / 下一首 / 随机播放；最底下一条“播放队列”，点开或往上拖拉开底部弹层，
  弹层按自己的高度滑进滑出，拉手往下拖、点按都收起（返回也先收起它）。换歌时封面换碟（CoverWheel），转出屏幕的部分被裁掉。
  红心（#30）和“更多”菜单（等有了加入歌单、查看歌手这类对当前这首有用的项）由之后的票加。放在 PlayerPage 里
-->
<script lang='ts'>
  import type { Song } from '$lib/api/library'
  import type { Playhead } from './playhead.svelte'
  import type { Turn } from './view'
  import { page } from '$app/state'
  import { ChevronDown, MicVocal } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import { langOf } from '../library/view'
  import { float, recede } from '../motion'
  import { DURATIONS, FLOAT_IN_DELAY, PAGE_DISTANCE } from '../motion-tokens'
  import { createCoverSwipe } from './cover-swipe.svelte'
  import CoverWheel from './CoverWheel.svelte'
  import { createDrawer } from './drawer.svelte'
  import Lyrics from './Lyrics.svelte'
  import NowPlayingTitle from './NowPlayingTitle.svelte'
  import PlayButton from './PlayButton.svelte'
  import { playerPageChoices as choices, closePlayerPage, closeQueueSheet, openQueueSheet, playerDrawer } from './player-page.svelte'
  import PlayModeButton from './PlayModeButton.svelte'
  import QueueList from './QueueList.svelte'
  import SkipButton from './SkipButton.svelte'
  import { neighborSong, PAGE_COVER } from './view'
  import WaveProgress from './WaveProgress.svelte'

  const { song, source, playhead, turn }: { song: Song, source: string | null, playhead: Playhead, turn: Turn | null } = $props()

  const view = getAppView()
  const queueOpen = $derived(page.state.player === 'queue')
  /** 拖封面时从左边、右边转进来的上一首、下一首 */
  const previous = $derived(neighborSong(view.state.player, 'previous'))
  const next = $derived(neighborSong(view.state.player, 'next'))

  /** 左右拖封面切歌；轻点封面换成歌词 */
  const swipe = createCoverSwipe({
    current: () => song.id,
    has: direction => view.state.player.neighbors[direction] !== null,
    commit: direction => view.app[direction](),
    tap: () => (choices.phoneLyrics = true),
  })

  /** 播放队列弹层占屏幕高度的这么多 */
  const SHEET_HEIGHT = 0.86

  let handle = $state<HTMLButtonElement>()
  let sheet = $state<HTMLElement>()

  /** 播放队列弹层：从底下的“播放队列”往上拖的头几帧它还没画出来，按屏幕高度的 86% 算 */
  const sheetDrawer = createDrawer(() => window.innerHeight * SHEET_HEIGHT)
  const gripTitle = playerDrawer.grip({ from: 'open', commit: closePlayerPage })
  const gripQueueBar = sheetDrawer.grip({ from: 'closed', commit: openQueueSheet, tap: openQueueSheet })
  const gripSheet = sheetDrawer.grip({ from: 'open', commit: closeQueueSheet, tap: closeQueueSheet })

  // 浅路由说拉开着就升起来，说收起就缩回去（返回、Esc、拉手、遮罩都走这里）
  $effect(() => sheetDrawer.settle(queueOpen))

  // 拉开播放队列时焦点进弹层，收起时回到“播放队列”那一条
  $effect(() => {
    if (!queueOpen)
      return
    sheet?.querySelector<HTMLElement>('button')?.focus()
    return () => handle?.focus()
  })
</script>

<div class='relative min-h-0 flex flex-1 flex-col' inert={queueOpen}>
  <div class='relative grid grid-cols-[48px_minmax(0,1fr)_48px] h-16 flex-none items-center px-1'>
    <button type='button' class='grid size-12 place-items-center rounded-full text-neutral-800 active:bg-white/60' aria-label='收起播放页' onclick={closePlayerPage}>
      <ChevronDown size={26} aria-hidden='true' />
    </button>
    <div class='min-w-0 text-center' {@attach gripTitle}>
      <p class='text-body text-neutral-900 font-500'>正在播放</p>
      {#if source}
        <p class='truncate text-caption text-neutral-700'>来自「<span lang={langOf(source)}>{source}</span>」</p>
      {/if}
    </div>
    <button
      type='button'
      class={['size-12 grid place-items-center rounded-full', choices.phoneLyrics ? 'bg-primary-100 text-primary-950' : 'text-neutral-800 active:bg-white/60']}
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
          in:float={{ toward: 'up', distance: PAGE_DISTANCE.in, duration: DURATIONS.panel, delay: FLOAT_IN_DELAY }}
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
      <NowPlayingTitle {song} {turn} phone />

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
    bind:this={handle}
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
    inert={!queueOpen}
  >
    <button type='button' class='grid mx-auto h-7 w-16 flex-none place-items-center rounded-full' aria-label='收起播放队列' title='往下拖或点按，收起播放队列' {@attach gripSheet}>
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

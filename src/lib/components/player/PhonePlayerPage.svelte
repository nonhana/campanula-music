<!--
  手机播放页（DESIGN.md Layout · 播放页，照 Auxio 的结构，原型 PhonePlayer），一屏放下、不滚动：
  顶上收起键、“正在播放 / 来自「…」”、歌词键；中间一大块是封面，按歌词键或点封面换成歌词，再按换回；
  下面左对齐的歌名、歌手、专辑，波浪进度条，上一首 / 播放 / 下一首；最底下一条“播放队列”，点开是底部弹层（返回先收起它）。
  红心（#30）、“更多”菜单和播放模式（#26）由之后的票加。放在 PlayerPage 里
-->
<script lang='ts'>
  import type { Song } from '$lib/api/library'
  import type { Playhead } from './playhead.svelte'
  import { page } from '$app/state'
  import { ChevronDown, MicVocal } from '@lucide/svelte'
  import { prefersReducedMotion } from 'svelte/motion'
  import { fade, fly } from 'svelte/transition'
  import Cover from '../library/Cover.svelte'
  import { langOf } from '../library/view'
  import Lyrics from './Lyrics.svelte'
  import NowPlayingTitle from './NowPlayingTitle.svelte'
  import PlayButton from './PlayButton.svelte'
  import { playerPageChoices as choices, closePlayerPage, closeQueueSheet, openQueueSheet } from './player-page.svelte'
  import QueueList from './QueueList.svelte'
  import SkipButton from './SkipButton.svelte'
  import WaveProgress from './WaveProgress.svelte'

  const { song, source, playhead }: { song: Song, source: string | null, playhead: Playhead } = $props()

  const queueOpen = $derived(page.state.player === 'queue')
  const ease = (t: number) => 1 - (1 - t) ** 4
  const swap = $derived(prefersReducedMotion.current ? 0 : 200)

  let handle = $state<HTMLButtonElement>()
  let sheet = $state<HTMLElement>()

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
    <div class='min-w-0 text-center'>
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
    <!-- 封面和歌词轮流占这一块 -->
    <div class='relative min-h-0 flex-1'>
      {#if choices.phoneLyrics}
        <div class='absolute inset-0 flex flex-col pt-1' transition:fade={{ duration: swap }}>
          <Lyrics {song} {playhead} compact class='min-h-0 flex-1' />
        </div>
      {:else}
        <div class='stage absolute inset-0 grid place-items-center' transition:fade={{ duration: swap }}>
          <button type='button' class='face rounded-xl' aria-label='显示歌词' onclick={() => (choices.phoneLyrics = true)}>
            <Cover url={song.album.coverUrl} size={360} fluid eager class='rounded-xl shadow-float' />
          </button>
        </div>
      {/if}
    </div>

    <div class='flex-none pt-5'>
      <NowPlayingTitle {song} phone />

      <div class='mt-2'>
        <WaveProgress {playhead} touch />
      </div>

      <div class='mt-3 flex items-center justify-center gap-5'>
        <SkipButton direction='previous' phone />
        <PlayButton size={72} />
        <SkipButton direction='next' phone />
      </div>
    </div>
  </div>

  <button
    bind:this={handle}
    type='button'
    class='relative h-14 flex flex-none flex-col items-center rounded-t-sheet bg-white/90 pt-2 shadow-float'
    aria-haspopup='dialog'
    aria-expanded={queueOpen}
    onclick={openQueueSheet}
  >
    <span class='h-1 w-9 rounded-full bg-neutral-300' aria-hidden='true'></span>
    <span class='mt-2 text-label text-neutral-800 font-500'>播放队列</span>
  </button>
</div>

{#if queueOpen}
  <button type='button' class='fixed inset-0 z-1 bg-neutral-900/30' aria-label='收起播放队列' tabindex='-1' onclick={closeQueueSheet} transition:fade={{ duration: prefersReducedMotion.current ? 0 : 200 }}></button>
  <div
    bind:this={sheet}
    class='fixed inset-x-0 bottom-0 z-2 h-[86dvh] flex flex-col rounded-t-sheet bg-white pb-[env(safe-area-inset-bottom)] shadow-float'
    role='dialog'
    aria-modal='true'
    aria-label='播放队列'
    transition:fly={{ y: 600, duration: prefersReducedMotion.current ? 0 : 380, opacity: 1, easing: ease }}
  >
    <button type='button' class='grid mx-auto h-7 w-16 flex-none place-items-center rounded-full' aria-label='收起播放队列' onclick={closeQueueSheet}>
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

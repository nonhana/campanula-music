<script lang="ts">
  import { ChevronDown, ListMusic, MicVocal } from '@lucide/svelte';
  import { onDestroy } from 'svelte';

  import type { Song } from '#lib/api/library.ts';

  import { trapFocus } from '../overlay/modal-focus.ts';
  import { getOverlays } from '../overlay/overlay-context.ts';
  import { getAppView } from '../shared/app-context.svelte.ts';
  import {
    DURATIONS,
    FLOAT_IN_DELAY,
    PAGE_DISTANCE,
  } from '../shared/motion-tokens.ts';
  import { fade, float, recede } from '../shared/motion.ts';
  import { langOf } from '../shared/text.ts';
  import HeartButton from '../songs/HeartButton.svelte';
  import SongMoreButton from '../songs/SongMoreButton.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import { createCoverSwipe } from './cover-swipe.svelte.ts';
  import CoverWheel from './CoverWheel.svelte';
  import { createDrawer, SHEET_HEIGHT } from './drawer.svelte.ts';
  import Lyrics from './Lyrics.svelte';
  import NowPlayingTitle from './NowPlayingTitle.svelte';
  import PlayButton from './PlayButton.svelte';
  import {
    playerPageChoices as choices,
    playerPageActions,
  } from './player-page.svelte.ts';
  import type { Playhead } from './playhead.svelte.ts';
  import PlayModeButton from './PlayModeButton.svelte';
  import QueueList from './QueueList.svelte';
  import SkipButton from './SkipButton.svelte';
  import type { Turn } from './view.ts';
  import { neighborSong, PAGE_COVER } from './view.ts';
  import { createScreenWakeLock } from './wake-lock.ts';
  import WaveProgress from './WaveProgress.svelte';

  const {
    song,
    source,
    playhead,
    turn,
  }: {
    song: Song;
    source: string | null;
    playhead: Playhead;
    turn: Turn | null;
  } = $props();

  const view = getAppView();
  const { player, queue, playerDrawer } = getOverlays();
  const { closePlayerPage, closeQueueSheet, openQueueSheet } =
    playerPageActions();
  const queueOpen = $derived(queue.request !== null);
  const previous = $derived(neighborSong(view.state.player, 'previous'));
  const next = $derived(neighborSong(view.state.player, 'next'));
  const entry = $derived(
    view.state.player.current === null
      ? null
      : view.state.player.queue[view.state.player.current],
  );

  const swipe = createCoverSwipe({
    current: () => song.id,
    has: (direction) => view.state.player.neighbors[direction] !== null,
    commit: (direction) => view.app[direction](),
    tap: () => (choices.phoneLyrics = true),
  });

  let sheet = $state<HTMLElement>();

  const sheetDrawer = createDrawer(() => window.innerHeight * SHEET_HEIGHT);
  const sheetCovered = $derived(queueOpen && sheetDrawer.position === 0);
  const visibleTurn = $derived(queueOpen ? null : turn);
  const gripTitle = playerDrawer.grip({
    from: 'open',
    commit: closePlayerPage,
  });
  const gripSheet = sheetDrawer.grip({
    from: 'open',
    commit: closeQueueSheet,
    tap: closeQueueSheet,
  });

  $effect(() => sheetDrawer.settle(queueOpen));

  $effect(() => {
    if (!queueOpen) return;
    sheet?.querySelector<HTMLElement>('button')?.focus();
  });

  const wakeLock = createScreenWakeLock();
  const keepAwake = $derived(
    player.request !== null &&
      !player.inert &&
      !queueOpen &&
      choices.phoneLyrics &&
      view.state.player.status === 'playing',
  );
  $effect(() => wakeLock.setActive(keepAwake));
  onDestroy(() => wakeLock.destroy());
</script>

<div class="relative min-h-0 flex flex-1 flex-col" inert={player.inert}>
  <div
    class="relative grid grid-cols-[48px_minmax(0,1fr)_48px] h-[calc(64px+env(safe-area-inset-top))] flex-none items-center px-1 pt-[env(safe-area-inset-top)]"
  >
    <button
      type="button"
      class="grid size-12 place-items-center rounded-full text-neutral-800 active:bg-white/60"
      aria-label="收起播放页"
      onclick={closePlayerPage}
    >
      <ChevronDown size={26} aria-hidden="true" />
    </button>
    <div class="min-w-0 text-center" {@attach gripTitle}>
      <p class="text-body text-neutral-900 font-500">正在播放</p>
      {#if source}
        <p class="truncate text-caption text-neutral-700" transition:fade>
          来自「<span lang={langOf(source)}>{source}</span>」
        </p>
      {/if}
    </div>
    <button
      type="button"
      class={[
        'size-12 grid place-items-center rounded-full transition-colors duration-feedback',
        choices.phoneLyrics
          ? 'bg-primary-100 text-primary-950'
          : 'text-neutral-800 active:bg-white/60',
      ]}
      aria-label="歌词"
      aria-pressed={choices.phoneLyrics}
      onclick={() => (choices.phoneLyrics = !choices.phoneLyrics)}
    >
      <MicVocal size={22} aria-hidden="true" />
    </button>
  </div>

  <div class="relative min-h-0 flex flex-1 flex-col px-6 pb-6">
    <div class="relative min-h-0 flex-1">
      {#if choices.phoneLyrics}
        <div
          class="absolute inset-0 flex flex-col pt-1"
          in:float={{
            toward: 'up',
            distance: PAGE_DISTANCE.in,
            duration: DURATIONS.panel,
            delay: FLOAT_IN_DELAY,
          }}
          out:float={{
            toward: 'down',
            distance: PAGE_DISTANCE.out,
            duration: DURATIONS['panel-out'],
          }}
        >
          <Lyrics {song} {playhead} compact class="min-h-0 flex-1" />
        </div>
      {:else}
        <div
          class="stage absolute inset-0 grid place-items-center"
          in:recede={{ delay: FLOAT_IN_DELAY }}
          out:recede
        >
          <button
            type="button"
            class="face rounded-xl"
            aria-label="显示歌词"
            {@attach swipe.grip}
          >
            <CoverWheel
              {song}
              turn={visibleTurn}
              duration={DURATIONS.focal}
              size={PAGE_COVER.phone}
              fluid
              eager
              class="rounded-xl shadow-float"
              drag={swipe.turned}
              {previous}
              {next}
            />
          </button>
        </div>
      {/if}
    </div>

    <div class={['flex-none pt-5', sheetCovered && 'invisible']}>
      <div class="flex items-start gap-1">
        <div class="min-w-0 flex-1">
          <NowPlayingTitle {song} turn={visibleTurn} phone />
        </div>
        <HeartButton {song} size="phone-page" />
        {#if entry}<SongMoreButton
            song={entry.song}
            source={entry.source}
            size="phone-page"
          />{/if}
      </div>

      <div class="mt-2">
        <WaveProgress {playhead} touch paused={queueOpen} />
      </div>

      <div class="mt-3 flex items-center justify-between">
        <PlayModeButton kind="cycle" phone />
        <div class="flex items-center gap-4">
          <SkipButton direction="previous" phone />
          <PlayButton size={72} />
          <SkipButton direction="next" phone />
        </div>
        <IconButton
          icon={ListMusic}
          label="播放队列"
          aria-haspopup="dialog"
          aria-expanded={queueOpen}
          data-queue-entry
          onclick={openQueueSheet}
        />
      </div>
    </div>
  </div>
</div>

{#if queueOpen || sheetDrawer.visible}
  <div class="pointer-events-none absolute inset-x-0 top-0 z-1 h-dvh">
    <button
      type="button"
      class="pointer-events-auto absolute inset-0 z-1 bg-neutral-900/30"
      style:opacity={1 - sheetDrawer.position}
      aria-label="收起播放队列"
      tabindex="-1"
      onclick={closeQueueSheet}
    ></button>
    <div
      bind:this={sheet}
      class="pointer-events-auto absolute inset-x-0 z-2 flex flex-col rounded-t-sheet bg-white shadow-float"
      style:top="{(1 - SHEET_HEIGHT) * 100}dvh"
      {@attach sheetDrawer.panel}
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-label="播放队列"
      inert={!queueOpen || queue.inert}
      {@attach trapFocus}
    >
      <button
        type="button"
        class="grid mx-auto h-7 w-16 flex-none place-items-center rounded-full"
        aria-label="收起播放队列"
        {@attach gripSheet}
      >
        <span class="h-1 w-9 rounded-full bg-neutral-300" aria-hidden="true"
        ></span>
      </button>
      <QueueList class="min-h-0 flex-1" />
    </div>
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

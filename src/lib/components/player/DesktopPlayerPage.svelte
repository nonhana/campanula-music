<script lang="ts">
  import { ChevronDown } from '@lucide/svelte';

  import type { Song } from '#lib/api/library.js';

  import { getOverlays } from '../overlay/overlay-context';
  import { getAppView } from '../shared/app-context.svelte';
  import { fade } from '../shared/motion';
  import { DURATIONS } from '../shared/motion-tokens';
  import { langOf } from '../shared/text';
  import HeartButton from '../songs/HeartButton.svelte';
  import SongMoreButton from '../songs/SongMoreButton.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import Segmented from '../ui/Segmented.svelte';
  import CoverWheel from './CoverWheel.svelte';
  import Lyrics from './Lyrics.svelte';
  import NowPlayingTitle from './NowPlayingTitle.svelte';
  import PlayButton from './PlayButton.svelte';
  import {
    playerPageChoices as choices,
    playerPageActions,
  } from './player-page.svelte';
  import type { Playhead } from './playhead.svelte';
  import PlayModeButton from './PlayModeButton.svelte';
  import QueueList from './QueueList.svelte';
  import SkipButton from './SkipButton.svelte';
  import type { Turn } from './view';
  import { PAGE_COVER } from './view';
  import VolumeControl from './VolumeControl.svelte';
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
  const { closePlayerPage } = playerPageActions();
  const { playerDrawer } = getOverlays();
  const entry = $derived(
    view.state.player.current === null
      ? null
      : view.state.player.queue[view.state.player.current],
  );

  const PANELS = [
    { key: 'lyrics', label: '歌词' },
    { key: 'queue', label: '播放队列' },
  ] as const;

  const uid = $props.id();
  const gripHandle = playerDrawer.grip({
    from: 'open',
    commit: closePlayerPage,
    tap: closePlayerPage,
  });
</script>

<header class="relative h-16 flex flex-none items-center gap-3 px-6">
  <IconButton
    icon={ChevronDown}
    label="收起播放页"
    title="收起（Esc）"
    onclick={closePlayerPage}
  />
  {#if source}
    <p class="min-w-0 truncate text-label text-neutral-700" transition:fade>
      来自「<span lang={langOf(source)}>{source}</span>」
    </p>
  {/if}
  <button
    type="button"
    class="group absolute left-1/2 top-1 grid h-6 w-40 cursor-grab place-items-center rounded-full -translate-x-1/2"
    aria-label="拖动把手：往下拖或点按，收起播放页"
    tabindex="-1"
    {@attach gripHandle}
  >
    <span
      class="h-1 w-10 rounded-full bg-neutral-400 transition-colors duration-feedback mouse:group-hover:bg-neutral-600"
      aria-hidden="true"
    ></span>
  </button>
</header>

<!-- --gap 也给换碟遮罩用；--gutter 给歌词向右借出；宽屏时左列与 --cover 等宽 -->
<div
  class="columns relative grid mx-auto max-w-[1440px] min-h-0 w-full flex-1 pb-8"
>
  <section class="min-h-0 flex flex-col justify-center" aria-label="播放控制">
    <div class="stage">
      <div class="cover mx-auto">
        <CoverWheel
          {song}
          {turn}
          duration={DURATIONS.focal}
          size={PAGE_COVER.desktop}
          fluid
          eager
          class="rounded-xl shadow-float"
        />
      </div>
    </div>

    <div class="mt-6 flex items-start gap-1">
      <div class="min-w-0 flex-1">
        <NowPlayingTitle {song} {turn} />
      </div>
      <HeartButton {song} size="desktop" />
      {#if entry}<SongMoreButton
          song={entry.song}
          source={entry.source}
          size="desktop-page"
        />{/if}
    </div>

    <div class="mt-3">
      <WaveProgress {playhead} />
    </div>

    <div class="mt-3 flex items-center justify-between">
      <PlayModeButton kind="repeat" />
      <div class="flex items-center gap-2 lg:gap-4">
        <SkipButton direction="previous" />
        <PlayButton size={64} />
        <SkipButton direction="next" />
      </div>
      <PlayModeButton kind="shuffle" />
    </div>

    {#if !view.state.touchPrimary}
      <div class="mt-4 flex items-center gap-2 -ml-2.5">
        <VolumeControl class="flex-1" />
      </div>
    {/if}
  </section>

  <section class="min-h-0 flex flex-col" aria-label="歌词和播放队列">
    <Segmented
      options={PANELS}
      value={choices.panel}
      onchange={(key) => (choices.panel = key)}
      role="tab"
      id={uid}
      label="右栏显示"
      class="h-11 w-[232px] flex-none self-start bg-white/70 shadow-ambient"
    />

    <div
      class="track mt-5 min-h-0 flex-1"
      style:--shown={PANELS.findIndex((panel) => panel.key === choices.panel)}
    >
      {#each PANELS as panel, index (panel.key)}
        {@const selected = choices.panel === panel.key}
        <div
          id="{uid}-{panel.key}"
          role="tabpanel"
          aria-labelledby="{uid}-{panel.key}-tab"
          class={['slide min-h-0 flex flex-col', !selected && 'away']}
          style:--slot={index}
          inert={!selected}
        >
          {#if panel.key === 'queue'}
            <QueueList class="flex-1" ground shown={selected} />
          {:else}
            <Lyrics {song} {playhead} class="flex-1" />
          {/if}
        </div>
      {/each}
    </div>
  </section>
</div>

<style>
  .columns {
    --gap: 40px;
    --gutter: 32px;
    --cover: min(420px, calc(100dvh - 440px));

    grid-template-columns: minmax(240px, 1fr) minmax(0, 1.15fr);
    column-gap: var(--gap);
    padding-inline: var(--gutter);
  }

  @media (min-width: 1024px) {
    .columns {
      --gap: 80px;
      --gutter: 48px;

      grid-template-columns: minmax(320px, var(--cover)) minmax(0, 1fr);
    }
  }

  .stage {
    --bleed: calc(var(--gap) / 2);
    --rise: 48px;
    --sink: 50%;

    margin: calc(-1 * var(--rise)) calc(-1 * var(--bleed))
      calc(-1 * var(--sink));
    padding: var(--rise) var(--bleed) var(--sink);
    mask-image: linear-gradient(
      to right,
      transparent,
      #000 var(--bleed),
      #000 calc(100% - var(--bleed)),
      transparent
    );
    pointer-events: none;
  }

  .cover {
    width: 100%;
    max-width: var(--cover);
  }

  .track {
    --bleed: 8px;
    --track-gap: calc(var(--gutter) + var(--bleed));

    display: grid;
    grid-template: minmax(0, 1fr) / minmax(0, 1fr);
    margin-inline: calc(-1 * var(--bleed)) calc(-1 * var(--gutter));
    padding-inline: var(--bleed) var(--gutter);
    overflow-x: clip;
  }

  .slide {
    grid-area: 1 / 1;
    translate: calc((var(--slot) - var(--shown)) * (100% + var(--track-gap)));
    transition:
      translate var(--move-panel) var(--ease-out-soft),
      opacity calc(var(--duration-panel) - var(--move-panel))
        var(--ease-out-soft);
  }

  .slide.away {
    opacity: 0;
    transition:
      translate var(--move-panel) var(--ease-out-soft)
        calc(var(--duration-panel-out) - var(--move-panel-out)),
      opacity var(--duration-panel-out) var(--ease-in-soft) var(--move-panel);
  }
</style>

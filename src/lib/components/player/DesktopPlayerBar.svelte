<script lang="ts">
  import { ListMusic, SkipBack, SkipForward } from '@lucide/svelte';

  import { getOverlays } from '../overlay/overlay-context';
  import { getAppView } from '../shared/app-context.svelte';
  import HeartButton from '../songs/HeartButton.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import { currentSong } from './now';
  import NowPlaying from './NowPlaying.svelte';
  import PlayButton from './PlayButton.svelte';
  import PlayModeButton from './PlayModeButton.svelte';
  import { QUEUE_PANEL_ID } from './QueuePanel.svelte';
  import { createSeekSlider } from './seek-slider.svelte';
  import SeekLine from './SeekLine.svelte';
  import { formatSeconds, PAGE_COVER } from './view';
  import VolumeControl from './VolumeControl.svelte';

  const view = getAppView();
  const { queuePanel } = getOverlays();
  const panelOpen = $derived(queuePanel.request !== null);
  const player = $derived(view.state.player);
  const song = $derived(currentSong(player));
  const slider = createSeekSlider();
  const shownTime = $derived(
    slider.dragging === null
      ? player.position
      : slider.dragging * slider.duration,
  );
</script>

<SeekLine {slider} />

<div
  class="grid grid-cols-[minmax(max-content,1fr)_minmax(0,440px)_minmax(max-content,1fr)] h-full items-center gap-6"
>
  <div class="flex items-center gap-1.5">
    <IconButton
      icon={SkipBack}
      filled
      label="上一首"
      onclick={() => view.app.previous()}
    />
    <PlayButton />
    <IconButton
      icon={SkipForward}
      filled
      label="下一首"
      onclick={() => view.app.next()}
    />
    <span
      class="ml-3 whitespace-nowrap text-caption text-neutral-600 tabular-nums"
    >
      {formatSeconds(shownTime)} / {formatSeconds(slider.duration)}
    </span>
  </div>

  {#if song}
    <div class="min-w-0 flex items-center gap-1">
      <NowPlaying
        size={48}
        pageCover={PAGE_COVER.desktop}
        class="py-1 pr-2 transition-colors duration-feedback mouse:hover:bg-primary-50"
        links
      />
      <HeartButton {song} size="desktop" />
    </div>
  {/if}

  <div class="flex items-center justify-end gap-1.5">
    <PlayModeButton kind="cycle" />
    {#if !view.state.touchPrimary}
      <VolumeControl class="w-24" />
    {/if}
    <IconButton
      icon={ListMusic}
      label="播放队列"
      class={['ml-2', panelOpen && 'bg-primary-200! text-primary-950!']}
      aria-expanded={panelOpen}
      aria-controls={panelOpen ? QUEUE_PANEL_ID : undefined}
      data-queue-toggle
      onclick={(event) => {
        if (panelOpen) void queuePanel.close();
        else void queuePanel.open({ from: event.currentTarget });
      }}
    />
  </div>
</div>

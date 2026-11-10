<script lang="ts">
  import { untrack } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { Tween } from 'svelte/motion';

  import { getAppView } from '../shared/app-context.svelte';
  import { easeOutSoft, moveMs } from '../shared/motion';
  import { DURATIONS } from '../shared/motion-tokens';
  import { currentSong } from './now';
  import type { Playhead } from './playhead.svelte';
  import { createSeekSlider } from './seek-slider.svelte';
  import { formatSeconds } from './view';

  const { playhead, touch = false }: { playhead: Playhead; touch?: boolean } =
    $props();

  const WAVELENGTH = 24;
  const MIDDLE = 12;
  const AMPLITUDE = 7;

  const uid = $props.id();
  const view = getAppView();
  const slider = createSeekSlider();
  const live = $derived(view.state.player.status === 'playing');

  let width = $state(0);

  const ratio = $derived(slider.ratio(playhead.now));
  const shownTime = $derived(ratio * slider.duration);
  const waving = $derived(live && slider.dragging === null);

  const drain = new Tween(0, { easing: easeOutSoft });
  const shown = $derived(Math.max(ratio, drain.current));
  const songId = $derived(currentSong(view.state.player)?.id);
  let lastSong = untrack(() => songId);
  let lastShown = untrack(() => shown);
  $effect(() => {
    if (songId !== lastSong) {
      void drain.set(lastShown, { duration: 0 });
      void drain.set(0, {
        duration: moveMs(DURATIONS.state),
      });
    }
    lastSong = songId;
    lastShown = shown;
  });
  const x = $derived(shown * width);

  const amplitude = Tween.of(() => (waving ? AMPLITUDE : 0), {
    duration: (_, to) =>
      moveMs(to === 0 ? DURATIONS['wave-flatten'] : DURATIONS['wave-rise']),
    easing: cubicOut,
  });

  const wavePath = $derived.by(() => {
    const half = WAVELENGTH / 2;
    let path = `M ${-WAVELENGTH} ${MIDDLE} q ${half / 2} ${-amplitude.current} ${half} 0`;
    for (let at = -WAVELENGTH + half; at < width + WAVELENGTH; at += half)
      path += ` t ${half} 0`;
    return path;
  });
</script>

<div class={['wave', touch && 'touch']}>
  <div
    bind:clientWidth={width}
    class="track"
    {...slider.attributes(ratio)}
    {@attach slider.attach}
  >
    {#if width > 0}
      <svg {width} height="24" viewBox="0 0 {width} 24" aria-hidden="true">
        <defs>
          <clipPath id="{uid}-played">
            <rect x="0" y="0" width={Math.max(0, x - 6)} height="24" />
          </clipPath>
        </defs>
        <line
          class="rest"
          x1={Math.min(width, x + 6)}
          y1={MIDDLE}
          x2={width}
          y2={MIDDLE}
        />
        <g clip-path="url(#{uid}-played)">
          <path class={['flow', waving && 'live']} d={wavePath} />
        </g>
        <rect class="thumb" x={x - 2} y="3" width="4" height="18" rx="2" />
      </svg>
    {/if}
  </div>
  <div
    class="times text-caption text-neutral-700 tabular-nums"
    aria-hidden="true"
  >
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

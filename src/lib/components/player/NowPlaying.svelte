<script lang="ts">
  import type { ClassValue } from 'svelte/elements';

  import { songTitle } from '#lib/api/library.js';

  import { getAppView } from '../shared/app-context.svelte';
  import { fade } from '../shared/motion';
  import { DURATIONS } from '../shared/motion-tokens';
  import { langOf } from '../shared/text';
  import CreditLine from '../songs/CreditLine.svelte';
  import SongBadge from '../songs/SongBadge.svelte';
  import { landingOf } from './cover-flight.svelte';
  import CoverWheel from './CoverWheel.svelte';
  import { currentSong } from './now';
  import { playerPageActions, prefetchPageCover } from './player-page.svelte';
  import SongSwap from './SongSwap.svelte';

  interface Props {
    size: number;
    pageCover: number;
    class?: ClassValue;
    nameClass?: string;
    links?: boolean;
  }

  const {
    size,
    pageCover,
    class: klass,
    nameClass = 'gap-2',
    links = false,
  }: Props = $props();
  const view = getAppView();
  const { gripToOpenPlayerPage } = playerPageActions();
  const player = $derived(view.state.player);
  const song = $derived(currentSong(player));
  const landing = landingOf(view, () => size);
  prefetchPageCover(
    () => song,
    () => pageCover,
  );
  const gripSong = gripToOpenPlayerPage();
</script>

{#if song}
  <div
    class={[
      'relative min-w-0 flex flex-1 items-center gap-3 rounded-lg',
      klass,
    ]}
  >
    <button
      type="button"
      class="open flex flex-none"
      aria-label="打开播放页：{songTitle(song)}"
      {@attach gripSong}
    >
      <span
        class="overflow-hidden rounded-md"
        style:width="{size}px"
        style:height="{size}px"
        {@attach landing.slot}
      >
        {#if landing.song}
          <CoverWheel
            song={landing.song}
            turn={landing.turn}
            duration={DURATIONS['focal-bar']}
            {size}
            eager
            class="rounded-md"
          />
        {/if}
      </span>
    </button>
    <SongSwap song={landing.song} turn={landing.turn} place="bar">
      {#snippet children(shown)}
        <span
          class={['min-w-0 flex items-center', nameClass]}
          aria-hidden="true"
        >
          <span
            class="truncate text-label text-neutral-900 font-500"
            lang={langOf(shown.name)}>{songTitle(shown)}</span
          >
          {#if player.trial}<span class="flex flex-none" transition:fade
              ><SongBadge kind="trial" /></span
            >{/if}
        </span>
        <!-- p-1 / -m-1：给焦点环留出一圈，位置不变 -->
        <CreditLine
          artists={shown.artists}
          linked={links}
          tabbable
          spoken={links}
          class="block truncate p-1 text-caption text-neutral-600 -m-1"
        />
      {/snippet}
    </SongSwap>
  </div>
{/if}

<style>
  .open::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 8px;
  }

  .open:focus-visible {
    outline: none;
  }

  .open:focus-visible::after {
    outline: 2px solid theme('colors.primary.800');
    outline-offset: 2px;
  }
</style>

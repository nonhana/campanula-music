<script lang="ts">
  import { innerHeight } from 'svelte/reactivity/window';

  import { trapFocus } from '../overlay/modal-focus.ts';
  import { getOverlays } from '../overlay/overlay-context.ts';
  import { getAppView } from '../shared/app-context.svelte.ts';
  import { desktopLayout } from '../shared/layout.ts';
  import CoverTint from './CoverTint.svelte';
  import DesktopPlayerPage from './DesktopPlayerPage.svelte';
  import { currentSong } from './now.ts';
  import PhonePlayerPage from './PhonePlayerPage.svelte';
  import { createPlayhead } from './playhead.svelte.ts';
  import { sourceName, turnOf } from './view.ts';

  const { open }: { open: boolean } = $props();

  const RADIUS = 24;
  const DIM = 0.2;

  const view = getAppView();
  const { player: layer, playerDrawer } = getOverlays();
  const player = $derived(view.state.player);
  const song = $derived(currentSong(player));
  const source = $derived(
    player.current === null
      ? null
      : sourceName(view.state.library, player.queue[player.current].source),
  );
  const turn = $derived(turnOf(player.change));
  const playhead = createPlayhead(() => view.state.player);
  const radius = $derived(
    Math.max(
      0,
      Math.min(RADIUS, playerDrawer.position * (innerHeight.current ?? 0)),
    ),
  );

  let root = $state<HTMLElement>();

  $effect(() => {
    if (!open) return;
    root?.querySelector<HTMLElement>('button')?.focus();
    const { documentElement } = document;
    documentElement.style.overflow = 'hidden';
    return () => {
      documentElement.style.overflow = '';
    };
  });
</script>

<div
  class="pointer-events-none fixed inset-0 z-49 bg-neutral-900"
  style:opacity={Math.min(1, 1 - playerDrawer.position) * DIM}
  aria-hidden="true"
></div>
<div
  bind:this={root}
  class="fixed inset-x-0 top-0 z-50 flex flex-col overflow-hidden shadow-float"
  {@attach playerDrawer.panel}
  style:border-radius="{radius}px {radius}px 0 0"
  role="dialog"
  tabindex="-1"
  aria-modal="true"
  aria-label="正在播放"
  inert={!open || layer.containerInert}
  {@attach trapFocus}
>
  {#if song}
    <CoverTint coverUrl={song.album.coverUrl} />
    {#if desktopLayout.current}
      <DesktopPlayerPage {song} {source} {playhead} {turn} />
    {:else}
      <PhonePlayerPage {song} {source} {playhead} {turn} />
    {/if}
  {/if}
</div>

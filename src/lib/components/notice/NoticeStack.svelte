<script lang="ts">
  import { getOverlays } from '../overlay/overlay-context';
  import PlayerNotice from '../player/PlayerNotice.svelte';
  import { getAppView } from '../shared/app-context.svelte';
  import { desktopLayout } from '../shared/layout';
  import OperationNotice from './OperationNotice.svelte';

  type Place = 'desktop' | 'top' | 'bottom';

  const view = getAppView();
  const overlays = getOverlays();
  const panel = $derived(overlays.downloadPanel);
  const operations = $derived(view.state.notices);
  const playerNotice = $derived(view.state.player.notice);
  const place = $derived<Place>(
    desktopLayout.current
      ? 'desktop'
      : overlays.playerLayer.open || panel.expanded
        ? 'top'
        : 'bottom',
  );
  const edge = $derived<'top' | 'bottom'>(place === 'top' ? 'top' : 'bottom');
  const phone = $derived(place !== 'desktop');
  const lifted = $derived(
    !desktopLayout.current &&
      panel.open &&
      panel.collapsed &&
      !panel.onDownloads,
  );

  const arrival = { moved: false };
  let lastPlace: Place | null = null;
  $effect.pre(() => {
    const now = operations.length > 0 || playerNotice ? place : null;
    arrival.moved = lastPlace !== null && now !== null && now !== lastPlace;
    lastPlace = now;
  });
</script>

{#if operations.length > 0 || playerNotice}
  {#key place}
    <div
      class={[
        'pointer-events-none fixed z-50 flex gap-2',
        place === 'desktop'
          ? 'bottom-24 left-1/2 max-w-[calc(100vw-48px)] -translate-x-1/2 flex-col items-center'
          : place === 'top'
            ? 'inset-x-2 top-16 flex-col-reverse'
            : lifted
              ? 'inset-x-2 bottom-[calc(136px+env(safe-area-inset-bottom))] flex-col'
              : 'inset-x-2 bottom-[calc(80px+env(safe-area-inset-bottom))] flex-col',
      ]}
    >
      {#each operations as entry (entry.id)}
        <OperationNotice {entry} {phone} {edge} moved={arrival.moved} />
      {/each}
      {#if playerNotice}
        <PlayerNotice {playerNotice} {phone} {edge} moved={arrival.moved} />
      {/if}
    </div>
  {/key}
{/if}

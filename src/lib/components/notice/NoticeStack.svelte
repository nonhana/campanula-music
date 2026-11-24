<script lang="ts">
  import { getOverlays } from '../overlay/overlay-context.ts';
  import PlayerNotice from '../player/PlayerNotice.svelte';
  import { getAppView } from '../shared/app-context.svelte.ts';
  import { desktopLayout } from '../shared/layout.ts';
  import NoticeCard from './NoticeCard.svelte';
  import OperationNotice from './OperationNotice.svelte';

  type Place = 'desktop' | 'top' | 'bottom';

  const view = getAppView();
  const overlays = getOverlays();
  const panel = $derived(overlays.downloadPanel);
  const operations = $derived(view.state.notices);
  const playerNotice = $derived(view.state.player.notice);
  const exitPrompt = $derived(overlays.exitPrompt);
  const visible = $derived(
    operations.length > 0 || playerNotice !== null || exitPrompt.open,
  );
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
    const now = visible ? place : null;
    arrival.moved = lastPlace !== null && now !== null && now !== lastPlace;
    lastPlace = now;
  });
</script>

{#if visible}
  {#key place}
    <div
      class={[
        'pointer-events-none fixed z-50 flex gap-2',
        place === 'desktop'
          ? 'left-1/2 max-w-[calc(100vw-48px)] -translate-x-1/2 flex-col items-center'
          : place === 'top'
            ? 'inset-x-2 top-[calc(64px+env(safe-area-inset-top))] flex-col-reverse'
            : 'inset-x-2 flex-col',
      ]}
      style:bottom={place === 'desktop'
        ? `${overlays.playerLayer.dockHeight + 16}px`
        : place === 'bottom'
          ? `calc(${overlays.playerLayer.dockHeight + (lifted ? 72 : 16)}px + env(safe-area-inset-bottom))`
          : undefined}
    >
      {#each operations as entry (entry.id)}
        <OperationNotice {entry} {phone} {edge} moved={arrival.moved} />
      {/each}
      {#if playerNotice}
        <PlayerNotice {playerNotice} {phone} {edge} moved={arrival.moved} />
      {/if}
      {#if exitPrompt.open}
        <NoticeCard
          tone="neutral"
          text="再按一次返回退出并停播，上划可后台继续播放"
          {phone}
          {edge}
          moved={arrival.moved}
          name="exit-guard-notice"
          onclose={exitPrompt.dismiss}
        />
      {/if}
    </div>
  {/key}
{/if}

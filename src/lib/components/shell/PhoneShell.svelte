<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onDestroy } from 'svelte';

  import OfflineBar from '../notice/OfflineBar.svelte';
  import { getOverlays } from '../overlay/overlay-context';
  import { createNowLocate, setNowLocate } from '../shared/now-locate.svelte';
  import { setScrollLookup } from '../shared/scroll-marks';
  import Scrollbar from '../ui/Scrollbar.svelte';
  import PageLocateButton from './PageLocateButton.svelte';
  import { playerDockBottom, playerDockTop } from './player-dock';
  import PlayerDock from './PlayerDock.svelte';
  import { pageScrollPadding, stickyBelowHeader } from './scroll-padding';

  interface Props {
    offline?: boolean;
    header: Snippet;
    tabs?: Snippet;
    replace?: Snippet;
    preview?: Snippet;
    children: Snippet;
  }

  const {
    offline = false,
    header,
    tabs,
    replace,
    preview,
    children,
  }: Props = $props();
  const lookup = setScrollLookup({ markAt: null });
  const { playerLayer } = getOverlays();
  const docked = $derived(
    preview !== undefined || replace !== undefined || playerLayer.hasQueue,
  );
  const scrollPadding = pageScrollPadding();

  let top = $state(0);
  const nowLocate = setNowLocate(
    createNowLocate({
      scroller: () => null,
      band: () => ({
        top: top + stickyBelowHeader(),
        bottom: playerDockTop(),
      }),
    }),
  );

  $effect(() =>
    scrollPadding.set(`calc(${top + 8}px + var(--sticky-below-header, 0px))`),
  );
  onDestroy(scrollPadding.release);
</script>

<div
  class={[
    'min-h-dvh bg-primary-50',
    docked
      ? 'pb-[calc(96px+env(safe-area-inset-bottom))]'
      : 'pb-[calc(32px+env(safe-area-inset-bottom))]',
  ]}
  style:--phone-top="{top}px"
>
  <div
    class="sticky top-0 z-20 bg-primary-50"
    bind:clientHeight={top}
    data-page-top
  >
    <header
      class="h-14 flex items-center gap-1 bg-primary-50 pl-4 pr-2"
      style:view-transition-name="phone-top"
      style:view-transition-class="crossfade"
    >
      {@render header()}
    </header>
    {#if tabs}
      <div
        class="bg-primary-50"
        style:view-transition-name="phone-tabs"
        style:view-transition-class="crossfade"
      >
        {@render tabs()}
      </div>
    {/if}
    {#if offline}
      <OfflineBar phone />
    {/if}
  </div>
  <main>
    {@render children()}
  </main>
  <PlayerDock present={docked} {replace} {preview} />
  <PageLocateButton locate={nowLocate} desktop={false} />
  <Scrollbar
    page={{
      top: `${top}px`,
      bottom: playerDockBottom({
        desktop: false,
        present: docked,
        withoutBar: 'env(safe-area-inset-bottom)',
      }),
    }}
    {lookup}
  />
</div>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onDestroy } from 'svelte';

  import OfflineBar, { OFFLINE_BAR_HEIGHT } from '../notice/OfflineBar.svelte';
  import { getOverlays } from '../overlay/overlay-context';
  import { createNowLocate, setNowLocate } from '../shared/now-locate.svelte';
  import { setScrollLookup } from '../shared/scroll-marks';
  import Scrollbar from '../ui/Scrollbar.svelte';
  import PageLocateButton from './PageLocateButton.svelte';
  import { playerDockBottom, playerDockTop } from './player-dock';
  import PlayerDock from './PlayerDock.svelte';
  import { pageScrollPadding, stickyBelowHeader } from './scroll-padding';

  interface Props {
    railExpanded: boolean;
    offline?: boolean;
    header: Snippet;
    rail: Snippet;
    railEnd?: Snippet;
    preview?: Snippet;
    children: Snippet;
  }

  const {
    railExpanded,
    offline = false,
    header,
    rail,
    railEnd,
    preview,
    children,
  }: Props = $props();
  const lookup = setScrollLookup({ markAt: null });
  const { playerLayer } = getOverlays();
  const docked = $derived(preview !== undefined || playerLayer.hasQueue);
  const scrollPadding = pageScrollPadding();
  const top = $derived(64 + (offline ? OFFLINE_BAR_HEIGHT : 0));
  const nowLocate = setNowLocate(
    createNowLocate({
      scroller: () => null,
      band: () => ({
        top: top + stickyBelowHeader(),
        bottom: playerDockTop(),
      }),
    }),
  );

  // 页面里吸在顶栏下的一行把高度写进 --sticky-below-header，一起让出来
  $effect(() =>
    scrollPadding.set(`calc(${top + 8}px + var(--sticky-below-header, 0px))`),
  );
  onDestroy(scrollPadding.release);
</script>

<div
  class="bg-primary-50 min-h-dvh"
  style:--rail-width={railExpanded ? '220px' : '72px'}
  style:--offline-bar-height={offline ? `${OFFLINE_BAR_HEIGHT}px` : '0px'}
>
  <header
    class="fixed inset-x-0 top-0 z-40 h-16 flex items-center gap-3 bg-primary-50 px-4"
    style:view-transition-name="shell-header"
    style:view-transition-class="still"
    data-page-top
  >
    {@render header()}
  </header>
  {#if offline}
    <div class="fixed inset-x-0 top-16 z-30">
      <OfflineBar />
    </div>
  {/if}
  <nav
    class={[
      'fixed bottom-0 left-0 z-30 w-[var(--rail-width)] flex flex-col overflow-hidden px-3 pb-4 pt-2 transition-[width] duration-move-state',
      !railExpanded && 'delay-state-out',
    ]}
    style:top={`${top}px`}
    style:view-transition-name="shell-rail"
    style:view-transition-class="still"
    aria-label="主导航"
  >
    {@render rail()}
    {#if railEnd}
      <div
        class={[
          'mt-auto transition-transform',
          docked
            ? 'duration-move-panel -translate-y-20'
            : 'duration-move-panel-out ease-in-soft',
        ]}
      >
        {@render railEnd()}
      </div>
    {/if}
  </nav>
  <main
    class={[
      'transition-[padding] duration-move-state',
      docked ? 'pb-28' : 'pb-12',
    ]}
    style:padding-top={`${top}px`}
  >
    <div
      class={[
        'pl-[var(--rail-width)] transition-[padding] duration-move-state',
        !railExpanded && 'delay-state-out',
      ]}
    >
      <div class="mx-auto max-w-[1280px] px-8 pt-4">
        {@render children()}
      </div>
    </div>
  </main>
  <PlayerDock present={docked} {preview} />
  <PageLocateButton locate={nowLocate} desktop />
  <Scrollbar
    page={{
      top: `${top}px`,
      bottom: playerDockBottom({
        desktop: true,
        present: docked,
        withoutBar: '0px',
      }),
    }}
    {lookup}
  />
</div>

<script lang="ts">
  import type { Component } from 'svelte';
  import { untrack } from 'svelte';
  import { innerHeight } from 'svelte/reactivity/window';

  import type { Song } from '#lib/api/library.ts';

  import { trapFocus } from '../overlay/modal-focus.ts';
  import { getOverlays } from '../overlay/overlay-context.ts';
  import { getAppView } from '../shared/app-context.svelte.ts';
  import { desktopLayout } from '../shared/layout.ts';
  import CoverTint from './CoverTint.svelte';
  import { currentSong } from './now.ts';
  import type { Playhead } from './playhead.svelte.ts';
  import { createPlayhead } from './playhead.svelte.ts';
  import type { Turn } from './view.ts';
  import { sourceName, turnOf } from './view.ts';

  type PageProps = {
    song: Song;
    source: string | null;
    playhead: Playhead;
    turn: Turn | null;
  };

  const {
    open,
    modal = true,
    initialDesktop,
    initialPhone,
  }: {
    open: boolean;
    modal?: boolean;
    initialDesktop?: Component<PageProps>;
    initialPhone?: Component<PageProps>;
  } = $props();

  const RADIUS = 24;
  const DIM = 0.2;

  const view = getAppView();
  const { player: layer, queue, playerDrawer } = getOverlays();
  const player = $derived(view.state.player);
  const song = $derived(currentSong(player));
  const source = $derived(
    player.current === null
      ? null
      : sourceName(view.state.library, player.queue[player.current].source),
  );
  const turn = $derived(turnOf(player.change));
  const playhead = createPlayhead(
    () => view.state.player,
    () => !desktopLayout.current && queue.request !== null,
  );
  const radius = $derived(
    Math.max(
      0,
      Math.min(RADIUS, playerDrawer.position * (innerHeight.current ?? 0)),
    ),
  );

  let DesktopPage = $state.raw<Component<PageProps> | undefined>(
    untrack(() => initialDesktop),
  );
  let PhonePage = $state.raw<Component<PageProps> | undefined>(
    untrack(() => initialPhone),
  );
  let loadingDesktop = false;
  let loadingPhone = false;

  $effect(() => {
    if (desktopLayout.current) {
      if (DesktopPage || loadingDesktop) return;
      loadingDesktop = true;
      void import('./DesktopPlayerPage.svelte')
        .then((module) => {
          DesktopPage = module.default;
        })
        .catch((error: unknown) => {
          loadingDesktop = false;
          console.error('加载桌面播放页失败', error);
        });
    } else {
      if (PhonePage || loadingPhone) return;
      loadingPhone = true;
      void import('./PhonePlayerPage.svelte')
        .then((module) => {
          PhonePage = module.default;
        })
        .catch((error: unknown) => {
          loadingPhone = false;
          console.error('加载手机播放页失败', error);
        });
    }
  });

  const Page = $derived(desktopLayout.current ? DesktopPage : PhonePage);

  let root = $state<HTMLElement>();

  $effect(() => {
    if (!open || !Page) return;
    if (modal) root?.querySelector<HTMLElement>('button')?.focus();
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
  role={modal ? 'dialog' : 'region'}
  tabindex="-1"
  aria-modal={modal ? 'true' : undefined}
  aria-label="正在播放"
  inert={!open || layer.containerInert}
  {@attach trapFocus}
>
  {#if song}
    <CoverTint coverUrl={song.album.coverUrl} />
    {#if Page}
      <Page {song} {source} {playhead} {turn} />
    {/if}
  {/if}
</div>

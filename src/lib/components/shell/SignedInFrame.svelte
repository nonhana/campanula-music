<script lang="ts">
  import { afterNavigate, goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { RouteId } from '$app/types';
  import type { Component, Snippet } from 'svelte';
  import { onDestroy, onMount, untrack } from 'svelte';

  import type { Account } from '#lib/api/account.ts';

  import { preloadHomeView } from '../library/home-view.svelte.ts';
  import { setOverlays } from '../overlay/overlay-context.ts';
  import OverlayHost from '../overlay/OverlayHost.svelte';
  import { createOverlays } from '../overlay/overlays.svelte.ts';
  import { currentSong } from '../player/now.ts';
  import PlayerLayer from '../player/PlayerLayer.svelte';
  import { resetSearchBox } from '../search/search-box.svelte.ts';
  import { getAppView } from '../shared/app-context.svelte.ts';
  import { desktopLayout } from '../shared/layout.ts';
  import { consumeLaunchQueue } from './launch-queue.ts';
  import { pageTransitions } from './page-transition.ts';
  import { warmPlayerBar } from './player-bar.svelte.ts';
  import { createWindowTitle, formatPlayingTitle } from './window-title.ts';

  type DesktopShellComponent = Component<{
    account: Account;
    children: Snippet;
  }>;
  type PhoneShellComponent = Component<{ children: Snippet }>;

  interface Props {
    account: Account;
    initialDesktop?: DesktopShellComponent;
    initialPhone?: PhoneShellComponent;
    children: Snippet;
  }

  const { account, initialDesktop, initialPhone, children }: Props = $props();
  const view = getAppView();
  const overlays = setOverlays(createOverlays());

  const PHONE_LIBRARY_ROUTES: readonly RouteId[] = [
    '/',
    '/playlists',
    '/albums',
    '/artists',
  ];
  pageTransitions(
    () => (desktopLayout.current ? ['/'] : PHONE_LIBRARY_ROUTES),
    (route) =>
      route === '/' ? preloadHomeView(desktopLayout.current) : undefined,
  );

  onMount(() => warmPlayerBar(() => desktopLayout.current));
  onMount(() =>
    consumeLaunchQueue({
      navigate(route) {
        if (overlays.stack.holdsHistory)
          void overlays.stack.leave(resolve(route));
        else if (location.pathname !== route || location.search !== '')
          void goto(resolve(route));
      },
      cleanCurrent(route) {
        void goto(resolve(route), { replace: true });
      },
    }),
  );

  let DesktopShellView = $state.raw<DesktopShellComponent | undefined>(
    untrack(() => initialDesktop),
  );
  let PhoneShellView = $state.raw<PhoneShellComponent | undefined>(
    untrack(() => initialPhone),
  );
  let loadingDesktop = false;
  let loadingPhone = false;

  $effect(() => {
    if (desktopLayout.current) {
      if (DesktopShellView || loadingDesktop) return;
      loadingDesktop = true;
      void import('./SignedInDesktop.svelte')
        .then((module) => {
          DesktopShellView = module.default;
        })
        .catch((error: unknown) => {
          loadingDesktop = false;
          console.error('加载桌面外壳失败', error);
        });
    } else {
      if (PhoneShellView || loadingPhone) return;
      loadingPhone = true;
      void import('./SignedInPhone.svelte')
        .then((module) => {
          PhoneShellView = module.default;
        })
        .catch((error: unknown) => {
          loadingPhone = false;
          console.error('加载手机外壳失败', error);
        });
    }
  });

  const hadDownloadsOnMount = untrack(
    () => view.state.downloads.tasks.size > 0,
  );
  let DownloadPanel = $state.raw<Component<{ autoExpand?: boolean }>>();
  let loadingDownloadPanel = false;

  $effect(() => {
    if (
      (view.state.downloads.tasks.size === 0 && !overlays.downloadPanel.open) ||
      DownloadPanel ||
      loadingDownloadPanel
    )
      return;
    loadingDownloadPanel = true;
    void import('../downloads/DownloadPanel.svelte')
      .then((module) => {
        DownloadPanel = module.default;
      })
      .catch((error: unknown) => {
        loadingDownloadPanel = false;
        console.error('加载下载面板失败', error);
      });
  });

  afterNavigate(({ shallow, type }) => {
    if (shallow && type === 'goto') return;
    resetSearchBox(view.app);
  });
  resetSearchBox(view.app);

  const windowTitle = createWindowTitle();
  $effect(() => {
    const { player } = view.state;
    const song = player.status === 'playing' ? currentSong(player) : null;
    windowTitle.setPlaying(song ? formatPlayingTitle(song) : null);
  });
  onDestroy(() => windowTitle.destroy());
  const playerCovered = $derived(
    overlays.playerLayer.open && overlays.playerDrawer.position === 0,
  );
</script>

<div
  class={['contents', playerCovered && 'invisible']}
  inert={overlays.stack.baseInert}
>
  {#if desktopLayout.current}
    {#if DesktopShellView}
      <DesktopShellView {account}>
        {@render children()}
      </DesktopShellView>
    {/if}
  {:else if PhoneShellView}
    <PhoneShellView>
      {@render children()}
    </PhoneShellView>
  {/if}
  {#if DownloadPanel}
    <DownloadPanel autoExpand={!hadDownloadsOnMount} />
  {/if}
</div>

<PlayerLayer />
<OverlayHost />

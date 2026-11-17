<script lang="ts">
  import { beforeNavigate } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { House } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import { onMount, untrack } from 'svelte';

  import Brand from '#lib/components/boot/Brand.svelte';
  import { setOverlays } from '#lib/components/overlay/overlay-context.ts';
  import OverlayHost from '#lib/components/overlay/OverlayHost.svelte';
  import { createOverlays } from '#lib/components/overlay/overlays.svelte.ts';
  import PlayerLayer from '#lib/components/player/PlayerLayer.svelte';
  import { getAppView } from '#lib/components/shared/app-context.svelte.ts';
  import { desktopLayout } from '#lib/components/shared/layout.ts';
  import DesktopShell from '#lib/components/shell/DesktopShell.svelte';
  import { pageTransitions } from '#lib/components/shell/page-transition.ts';
  import PhoneShell from '#lib/components/shell/PhoneShell.svelte';

  const { children }: { children: Snippet } = $props();
  const view = getAppView();
  const overlays = setOverlays(createOverlays());
  const embedded = window.parent !== window;
  pageTransitions(() => ['/']);
  beforeNavigate(({ to, cancel }) => {
    if (
      to?.url.origin === location.origin &&
      to.url.pathname.startsWith('/guide/')
    )
      return;
    if (
      to &&
      !/^\/demo\/(?:playlists(?:\/(?:501|502))?\/?)?$/.test(to.url.pathname)
    ) {
      cancel();
      view.app.toast(
        'error',
        '示例只开放曲库、播放、歌词和队列；用自己的账号需先部署。',
      );
    }
  });
  let initial = false;
  $effect(() => {
    if (initial || view.state.player.current === null) return;
    initial = true;
    if (page.url.searchParams.get('screen') === 'player')
      untrack(() => {
        void overlays.player.open({ from: null });
      });
  });
  onMount(() => {
    parent.postMessage({ type: 'campanula-demo-ready' }, location.origin);
  });
</script>

{#snippet header()}
  <a
    href={resolve('/')}
    aria-label="Campanula · 回到示例曲库"
    class="rounded-lg"><Brand /></a
  >
  <span class="ml-auto text-caption text-neutral-600"
    >本地示例 · 不登录账号</span
  >
{/snippet}
{#snippet content()}
  <p class="py-3 text-caption text-neutral-600">
    三段演示音频和对应的示意歌词。这里只试播放、歌词与队列，不开放账号、下载和曲库写入。
  </p>
  {@render children()}
{/snippet}
<div class="contents" inert={overlays.stack.baseInert}>
  {#if desktopLayout.current}
    <DesktopShell railExpanded={false} {header}>
      {#snippet rail()}
        <a
          href={resolve('/')}
          aria-label="示例曲库"
          class="grid h-12 place-items-center rounded-lg bg-primary-200 text-primary-950"
          ><House size={22} aria-hidden="true" /></a
        >
      {/snippet}
      {@render content()}
    </DesktopShell>
  {:else}
    <PhoneShell {header}><div class="px-4">{@render content()}</div></PhoneShell
    >
  {/if}
</div>
<PlayerLayer modal={!embedded} />
<OverlayHost />

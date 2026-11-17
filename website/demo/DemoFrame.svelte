<script lang="ts">
  import { beforeNavigate } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { House } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import { tick, untrack } from 'svelte';

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
  let ready = false;
  $effect(() => {
    if (view.state.player.current === null) return;
    const player = page.url.searchParams.get('screen') === 'player';
    if (!initial) {
      initial = true;
      untrack(() => {
        if (player) void overlays.player.open({ from: null });
      });
    }
    if (
      ready ||
      (player &&
        (!overlays.playerLayer.open || overlays.playerDrawer.position !== 0))
    )
      return;
    ready = true;
    void document.fonts.ready.then(async () => {
      await tick();
      await Promise.allSettled(
        document
          .getAnimations()
          .filter(
            (animation) =>
              animation.effect?.getComputedTiming().iterations !== Infinity,
          )
          .map((animation) => animation.finished),
      );
      parent.postMessage({ type: 'campanula-demo-ready' }, location.origin);
    });
  });
</script>

{#snippet header()}
  <a
    href={resolve('/')}
    aria-label="Campanula · 回到示例曲库"
    class="rounded-lg"><Brand /></a
  >
  <span class="ml-auto text-caption text-neutral-600">示例音频</span>
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
      {@render children()}
    </DesktopShell>
  {:else}
    <PhoneShell {header}
      ><div class="px-4">{@render children()}</div></PhoneShell
    >
  {/if}
</div>
<PlayerLayer modal={!embedded} />
<OverlayHost />

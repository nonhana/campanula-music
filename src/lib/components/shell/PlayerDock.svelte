<script lang="ts">
  import type { Snippet } from 'svelte';

  import DesktopPlayerBar from '../player/DesktopPlayerBar.svelte';
  import PhoneMiniPlayer from '../player/PhoneMiniPlayer.svelte';
  import { queueEmpty } from '../player/view';
  import { getAppView } from '../shared/app-context.svelte';
  import { desktopLayout } from '../shared/layout';
  import { dock, fade } from '../shared/motion';
  import { DURATIONS } from '../shared/motion-tokens';

  interface Props {
    present: boolean;
    replace?: Snippet;
    preview?: Snippet;
  }

  const { present, replace, preview }: Props = $props();
  const view = getAppView();
  // 收起那一刻直接读 App 状态：外框整个拿掉时 $derived 停在旧值上
  const emptied = () => queueEmpty(view.app.state.player);
  const chrome = $derived(
    preview === undefined
      ? {
          bar: 'player-bar',
          fade: 'bar-fade',
          still: 'still',
          anchor: true,
        }
      : {
          bar: undefined,
          fade: undefined,
          still: undefined,
          anchor: undefined,
        },
  );
</script>

{#if present}
  {#if desktopLayout.current}
    <div
      class="fixed inset-x-0 bottom-0 z-40 h-20 bg-white px-5 shadow-float"
      style:view-transition-name={chrome.bar}
      style:view-transition-class={chrome.still}
      data-player-bar={chrome.anchor}
      in:dock
      out:dock|global={{
        gone: emptied(),
      }}
    >
      {#if preview}
        {@render preview()}
      {:else}
        <DesktopPlayerBar />
      {/if}
    </div>
  {:else}
    <div
      class="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-[calc(104px+env(safe-area-inset-bottom))] from-primary-50/0 to-primary-50 bg-gradient-to-b"
      style:view-transition-name={chrome.fade}
      style:view-transition-class={chrome.still}
      aria-hidden="true"
      in:fade={{ duration: DURATIONS.panel }}
      out:fade|global={{
        duration: emptied() ? DURATIONS['panel-out'] : 0,
      }}
    ></div>
    <div
      class="fixed inset-x-2 bottom-[calc(8px+env(safe-area-inset-bottom))] z-40 h-16 overflow-hidden rounded-xl bg-white shadow-float"
      style:view-transition-name={chrome.bar}
      style:view-transition-class={chrome.still}
      data-player-bar={chrome.anchor}
      in:dock
      out:dock|global={{
        gone: emptied(),
      }}
    >
      {#if preview}
        {@render preview()}
      {:else if replace}
        {@render replace()}
      {:else}
        <PhoneMiniPlayer />
      {/if}
    </div>
  {/if}
{/if}

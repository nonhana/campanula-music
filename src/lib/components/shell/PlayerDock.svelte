<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Attachment } from 'svelte/attachments';

  import { getOverlays } from '../overlay/overlay-context.ts';
  import DesktopPlayerBar from '../player/DesktopPlayerBar.svelte';
  import PhoneMiniPlayer from '../player/PhoneMiniPlayer.svelte';
  import { queueEmpty } from '../player/view.ts';
  import { getAppView } from '../shared/app-context.svelte.ts';
  import { desktopLayout } from '../shared/layout.ts';
  import { DURATIONS } from '../shared/motion-tokens.ts';
  import { dock, fade } from '../shared/motion.ts';
  import { PHONE_DOCK_HEIGHT } from './player-dock.ts';

  interface Props {
    present: boolean;
    replace?: Snippet;
    preview?: Snippet;
  }

  const { present, replace, preview }: Props = $props();
  const view = getAppView();
  const { playerLayer } = getOverlays();
  const resetHeight: Attachment<HTMLElement> = () => () => {
    playerLayer.dockHeight = PHONE_DOCK_HEIGHT;
  };
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
      class="fixed inset-x-0 bottom-0 z-40 grid min-h-20 bg-white px-5 shadow-float"
      role="region"
      aria-label="播放条"
      bind:clientHeight={playerLayer.dockHeight}
      {@attach resetHeight}
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
      class="pointer-events-none fixed inset-x-0 bottom-0 z-30 from-primary-50/0 to-primary-50 bg-gradient-to-b"
      style:height="calc({playerLayer.dockHeight + 40}px +
      env(safe-area-inset-bottom))"
      style:view-transition-name={chrome.fade}
      style:view-transition-class={chrome.still}
      aria-hidden="true"
      in:fade={{ duration: DURATIONS.panel }}
      out:fade|global={{
        duration: emptied() ? DURATIONS['panel-out'] : 0,
      }}
    ></div>
    <div
      class="fixed inset-x-2 bottom-[calc(8px+env(safe-area-inset-bottom))] z-40 grid min-h-16 overflow-hidden rounded-xl bg-white shadow-float"
      role="region"
      aria-label={replace ? '多选操作' : '播放条'}
      bind:clientHeight={playerLayer.dockHeight}
      {@attach resetHeight}
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

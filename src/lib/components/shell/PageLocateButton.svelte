<!-- 挂在外框这一层：放进会做 transform 的祖先里，fixed 会跟着跑 -->
<script lang="ts">
  import { getOverlays } from '../overlay/overlay-context.ts';
  import type { NowLocate } from '../shared/now-locate.svelte.ts';
  import LocateNowButton from '../songs/LocateNowButton.svelte';

  const { locate, desktop }: { locate: NowLocate; desktop: boolean } = $props();
  const { downloadPanel, queuePanel, playerLayer } = getOverlays();
  const lifted = $derived(
    !desktop &&
      downloadPanel.open &&
      downloadPanel.collapsed &&
      !downloadPanel.onDownloads,
  );
</script>

<div class="contents" style:--player-dock-height="{playerLayer.dockHeight}px">
  <LocateNowButton
    {locate}
    hidden={desktop && queuePanel.request !== null}
    class={[
      'fixed z-30',
      desktop
        ? [
            'bottom-[calc(var(--player-dock-height)+16px)]',
            downloadPanel.expanded ? 'right-[392px]' : 'right-6',
          ]
        : [
            'right-4',
            lifted
              ? 'bottom-[calc(var(--player-dock-height)+76px+env(safe-area-inset-bottom))]'
              : 'bottom-[calc(var(--player-dock-height)+20px+env(safe-area-inset-bottom))]',
          ],
    ]}
  />
</div>

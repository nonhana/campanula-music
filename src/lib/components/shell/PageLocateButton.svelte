<!-- 挂在外框这一层：放进会做 transform 的祖先里，fixed 会跟着跑 -->
<script lang="ts">
  import { getOverlays } from '../overlay/overlay-context';
  import type { NowLocate } from '../shared/now-locate.svelte';
  import LocateNowButton from '../songs/LocateNowButton.svelte';

  const { locate, desktop }: { locate: NowLocate; desktop: boolean } = $props();
  const { downloadPanel, queuePanel } = getOverlays();
  const lifted = $derived(
    !desktop &&
      downloadPanel.open &&
      downloadPanel.collapsed &&
      !downloadPanel.onDownloads,
  );
</script>

<LocateNowButton
  {locate}
  hidden={desktop && queuePanel.request !== null}
  class={[
    'fixed z-30',
    desktop
      ? ['bottom-24', downloadPanel.expanded ? 'right-[392px]' : 'right-6']
      : [
          'right-4',
          lifted
            ? 'bottom-[calc(140px+env(safe-area-inset-bottom))]'
            : 'bottom-[calc(84px+env(safe-area-inset-bottom))]',
        ],
  ]}
/>

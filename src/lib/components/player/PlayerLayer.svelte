<!-- 先画播放页、后画提示：别调换，反了提示会被盖住却仍能 Tab 聚焦 -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  import NoticeStack from '../notice/NoticeStack.svelte';
  import { getOverlays } from '../overlay/overlay-context';
  import PlayerPage from './PlayerPage.svelte';

  const { children }: { children?: Snippet } = $props();
  const { player: layer, playerLayer } = getOverlays();
</script>

<div class="contents" data-overlay="player" inert={layer.containerInert}>
  {#if playerLayer.shown}
    <PlayerPage open={playerLayer.open} />
  {/if}
  <NoticeStack />
  {@render children?.()}
</div>

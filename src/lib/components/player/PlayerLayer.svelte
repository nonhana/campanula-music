<!-- 先画播放页、后画提示：别调换，反了提示会被盖住却仍能 Tab 聚焦 -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  import { songTitle } from '#lib/api/library.ts';

  import NoticeStack from '../notice/NoticeStack.svelte';
  import { getOverlays } from '../overlay/overlay-context.ts';
  import { getAppView } from '../shared/app-context.svelte.ts';
  import { currentSong } from './now.ts';
  import PlayerPage from './PlayerPage.svelte';

  const { children }: { children?: Snippet } = $props();
  const { player: layer, playerLayer } = getOverlays();
  const view = getAppView();
  const player = $derived(view.state.player);
  const current = $derived(currentSong(player));
  const playbackStatus = {
    loading: '正在加载',
    buffering: '正在缓冲',
    playing: '正在播放',
    paused: '已暂停',
  } as const;
</script>

<div class="contents" data-overlay="player" inert={layer.containerInert}>
  {#if playerLayer.shown}
    <PlayerPage open={playerLayer.open} />
  {/if}
  <span class="sr-only" role="status" aria-label="播放状态" aria-atomic="true"
    >{current
      ? `${playbackStatus[player.status]}：${songTitle(current)}`
      : ''}</span
  >
  <NoticeStack />
  {@render children?.()}
</div>

<!-- 先画播放页、后画提示：别调换，反了提示会被盖住却仍能 Tab 聚焦 -->
<script lang="ts">
  import type { Component, Snippet } from 'svelte';

  import { songTitle } from '#lib/api/library.ts';

  import NoticeStack from '../notice/NoticeStack.svelte';
  import { getOverlays } from '../overlay/overlay-context.ts';
  import { getAppView } from '../shared/app-context.svelte.ts';
  import { currentSong } from './now.ts';

  const { children, modal = true }: { children?: Snippet; modal?: boolean } =
    $props();
  const { player: layer, playerLayer } = getOverlays();
  const view = getAppView();
  const player = $derived(view.state.player);
  const current = $derived(currentSong(player));
  let PlayerPage = $state.raw<Component<{ open: boolean; modal?: boolean }>>();
  let loadingPage = false;

  $effect(() => {
    if (
      (!playerLayer.hasQueue && !playerLayer.shown) ||
      PlayerPage ||
      loadingPage
    )
      return;
    loadingPage = true;
    void import('./PlayerPage.svelte')
      .then((module) => {
        PlayerPage = module.default;
      })
      .catch((error: unknown) => {
        loadingPage = false;
        console.error('加载播放页失败', error);
      });
  });

  const playbackStatus = {
    loading: '正在加载',
    buffering: '正在缓冲',
    playing: '正在播放',
    paused: '已暂停',
  } as const;
</script>

<div class="contents" data-overlay="player" inert={layer.containerInert}>
  {#if playerLayer.shown && PlayerPage}
    <PlayerPage open={playerLayer.open} {modal} />
  {/if}
  <span class="sr-only" role="status" aria-label="播放状态" aria-atomic="true"
    >{current
      ? `${playbackStatus[player.status]}：${songTitle(current)}`
      : ''}</span
  >
  <NoticeStack />
  {@render children?.()}
</div>

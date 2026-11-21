<!-- 先画播放页、后画提示：别调换，反了提示会被盖住却仍能 Tab 聚焦 -->
<script lang="ts">
  import type { Component, Snippet } from 'svelte';

  import type { Song } from '#lib/api/library.ts';
  import { songTitle } from '#lib/api/library.ts';

  import NoticeStack from '../notice/NoticeStack.svelte';
  import { getOverlays } from '../overlay/overlay-context.ts';
  import { getAppView } from '../shared/app-context.svelte.ts';
  import { desktopLayout } from '../shared/layout.ts';
  import { currentSong } from './now.ts';
  import type { Playhead } from './playhead.svelte.ts';
  import type { Turn } from './view.ts';

  type PageView = Component<{
    song: Song;
    source: string | null;
    playhead: Playhead;
    turn: Turn | null;
  }>;

  const { children, modal = true }: { children?: Snippet; modal?: boolean } =
    $props();
  const { player: layer, playerLayer } = getOverlays();
  const view = getAppView();
  const player = $derived(view.state.player);
  const current = $derived(currentSong(player));
  let PlayerPage = $state.raw<
    Component<{
      open: boolean;
      modal?: boolean;
      initialDesktop?: PageView;
      initialPhone?: PageView;
    }>
  >();
  let initialDesktop = $state.raw<PageView>();
  let initialPhone = $state.raw<PageView>();
  let loadingPage = false;

  $effect(() => {
    if (
      (!playerLayer.hasQueue && !playerLayer.shown) ||
      PlayerPage ||
      loadingPage
    )
      return;
    loadingPage = true;
    const isDesktop = desktopLayout.current;
    // 分别写入独立变量，防止压缩器将两分支的 preload 调用合并成一个而丢掉桌面端样式清单
    let desktopLoad: Promise<void> | undefined;
    let phoneLoad: Promise<void> | undefined;
    if (isDesktop) {
      desktopLoad = import('./DesktopPlayerPage.svelte').then((module) => {
        initialDesktop = module.default;
      });
    } else {
      phoneLoad = import('./PhonePlayerPage.svelte').then((module) => {
        initialPhone = module.default;
      });
    }
    void Promise.all([import('./PlayerPage.svelte'), desktopLoad, phoneLoad])
      .then(([pageModule]) => {
        PlayerPage = pageModule.default;
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
    <PlayerPage
      open={playerLayer.open}
      {modal}
      {initialDesktop}
      {initialPhone}
    />
  {/if}
  <span class="sr-only" role="status" aria-label="播放状态" aria-atomic="true"
    >{current
      ? `${playbackStatus[player.status]}：${songTitle(current)}`
      : ''}</span
  >
  <NoticeStack />
  {@render children?.()}
</div>

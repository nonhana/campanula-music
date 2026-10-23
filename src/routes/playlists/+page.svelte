<!--
  曲库的“歌单”标签：上面一块自建，下面一块收藏（#37 作者 2026-10-21 定，不再用 全部 / 自建 / 收藏 按钮筛选）。
  手机在曲库的文字标签下面；桌面没有标签（首页已经有歌单区块），直接打开这个地址时照样显示。
  返回这一页时，滚动位置回到原来的样子
-->
<script lang='ts'>
  import { getAppView } from '#lib/components/app-context.svelte.js'
  import { desktopLayout } from '#lib/components/layout.js'
  import PlaylistGrid from '#lib/components/library/PlaylistGrid.svelte'
  import SyncNotice from '#lib/components/library/SyncNotice.svelte'
  import { scrollSnapshot } from '#lib/components/snapshot.js'

  const view = getAppView()
  const library = $derived(view.state.library)

  /** 这一页没有要恢复的状态，只把滚动位置记下来 */
  scrollSnapshot('/playlists', () => null, () => {})
</script>

<svelte:head><title>歌单 · Campanula</title></svelte:head>

{#if library}
  {#if desktopLayout.current}
    <SyncNotice library={library} failureShown={library.playlists === null} />
    <div class='mt-6'>
      <PlaylistGrid {library} sectionLevel={2}>
        {#snippet heading()}
          <h1 class='text-headline text-neutral-900 font-600'>歌单</h1>
        {/snippet}
      </PlaylistGrid>
    </div>
  {:else}
    <h1 class='sr-only'>歌单</h1>
    <SyncNotice {library} failureShown={library.playlists === null} phone />
    <PlaylistGrid {library} phone sectionLevel={2} />
  {/if}
{/if}

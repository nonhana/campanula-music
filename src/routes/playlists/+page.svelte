<!--
  曲库的“歌单”标签：上面一块自建，下面一块收藏（#37，作者 2026-10-21 定，不再用按钮筛选）。
  手机在曲库的文字标签下面；桌面没有标签（首页已有歌单区块），直接打开这个地址时照样显示。
-->
<script lang='ts'>
  import { syncNoticeFor } from '#lib/app/library.js'
  import PlaylistGrid from '#lib/components/library/PlaylistGrid.svelte'
  import SyncNotice from '#lib/components/library/SyncNotice.svelte'
  import { getAppView } from '#lib/components/shared/app-context.svelte.js'
  import { desktopLayout } from '#lib/components/shared/layout.js'
  import { scrollSnapshot } from '#lib/components/shared/snapshot.js'

  const view = getAppView()
  const library = $derived(view.state.library)
  /** 列表本身没拿到时，网格的整块错误已经说了同一次失败；同步条不再重复 */
  const notice = $derived(library && syncNoticeFor(library, library.playlists === null))

  /** 这一页没有要恢复的状态，只把滚动位置记下来 */
  scrollSnapshot('/playlists', () => null, () => {})
</script>

<svelte:head><title>歌单 · Campanula</title></svelte:head>

{#if library}
  {#if desktopLayout.current}
    <SyncNotice {notice} />
    <div class='mt-6'>
      <PlaylistGrid {library} sectionLevel={2}>
        {#snippet heading()}
          <h1 class='text-headline text-neutral-900 font-600'>歌单</h1>
        {/snippet}
      </PlaylistGrid>
    </div>
  {:else}
    <h1 class='sr-only'>歌单</h1>
    <SyncNotice {notice} phone />
    <PlaylistGrid {library} phone sectionLevel={2} />
  {/if}
{/if}

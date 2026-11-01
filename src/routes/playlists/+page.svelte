<!--
  曲库的“歌单”标签：顶上是筛选框，下面一块自建、一块收藏（#37，作者 2026-10-21 定，不再用按钮筛选）；自建歌单的“排序”在这一页（作者 2026-11-01 定）。
  手机在曲库的文字标签下面；桌面从首页自建、收藏的歌单那两排的“查看全部”进来（收藏的那个直接停在收藏那块）。返回这一页时筛选词和滚动位置一起回到原来的样子
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
  let query = $state('')
  scrollSnapshot('/playlists', () => query, (value) => {
    query = value
  })
</script>

<svelte:head><title>歌单 · Campanula</title></svelte:head>

{#if library}
  {#if desktopLayout.current}
    <SyncNotice {notice} />
    <PlaylistGrid {library} bind:query />
  {:else}
    <h1 class='sr-only'>歌单</h1>
    <SyncNotice {notice} phone />
    <PlaylistGrid {library} phone bind:query />
  {/if}
{/if}

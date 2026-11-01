<!--
  曲库的“专辑”标签：收藏的专辑，顶上是筛选框。手机在曲库的文字标签下面（两列封面网格）；桌面从首页专辑那一排的“查看全部”进来（封面网格，作者 2026-11-01 定）。
  返回这一页时筛选词和滚动位置一起回到原来的样子
-->
<script lang='ts'>
  import { syncNoticeFor } from '#lib/app/library.js'
  import CollectedGrid from '#lib/components/library/CollectedGrid.svelte'
  import SyncNotice from '#lib/components/library/SyncNotice.svelte'
  import { getAppView } from '#lib/components/shared/app-context.svelte.js'
  import { desktopLayout } from '#lib/components/shared/layout.js'
  import { scrollSnapshot } from '#lib/components/shared/snapshot.js'

  const view = getAppView()
  const library = $derived(view.state.library)
  /** 列表本身没拿到时，网格的整块错误已经说了同一次失败；同步条不再重复 */
  const notice = $derived(library && syncNoticeFor(library, library.albums === null))
  let query = $state('')
  scrollSnapshot('/albums', () => query, (value) => {
    query = value
  })
</script>

<svelte:head><title>专辑 · Campanula</title></svelte:head>

{#if library}
  {#if desktopLayout.current}
    <SyncNotice {notice} />
    <CollectedGrid {library} kind='albums' layout='grid' bind:query />
  {:else}
    <h1 class='sr-only'>专辑</h1>
    <SyncNotice {notice} phone />
    <CollectedGrid {library} kind='albums' layout='phone' bind:query />
  {/if}
{/if}

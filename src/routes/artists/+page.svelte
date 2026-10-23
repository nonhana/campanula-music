<!--
  曲库的“歌手”标签：收藏的歌手，三列圆形头像网格。
  手机上在曲库的文字标签下面；桌面没有标签（首页已经有歌手架子），直接打开这个地址时照样显示。返回这一页时滚动位置回到原来的样子
-->
<script lang='ts'>
  import { syncNoticeFor } from '#lib/app/library.js'
  import { getAppView } from '#lib/components/app-context.svelte.js'
  import { desktopLayout } from '#lib/components/layout.js'
  import CollectedGrid from '#lib/components/library/CollectedGrid.svelte'
  import SyncNotice from '#lib/components/library/SyncNotice.svelte'
  import { formatCount } from '#lib/components/library/view.js'
  import { fade } from '#lib/components/motion.js'
  import { scrollSnapshot } from '#lib/components/snapshot.js'

  const view = getAppView()
  const library = $derived(view.state.library)
  /** 列表本身没拿到时，网格的整块错误已经说了同一次失败；同步条不再重复 */
  const notice = $derived(library && syncNoticeFor(library, library.artists === null))
  scrollSnapshot('/artists', () => null, () => {})
</script>

<svelte:head><title>歌手 · Campanula</title></svelte:head>

{#if library}
  {#if desktopLayout.current}
    <SyncNotice {notice} />
    <div class='mb-4 mt-6 flex items-center gap-3'>
      <h1 class='text-headline text-neutral-900 font-600'>歌手</h1>
      {#if library.artists}<span class='text-caption text-neutral-500 tabular-nums' in:fade>{formatCount(library.artists.length)} 位</span>{/if}
    </div>
    <CollectedGrid {library} kind='artists' layout='grid' />
  {:else}
    <h1 class='sr-only'>歌手</h1>
    <SyncNotice {notice} phone />
    <CollectedGrid {library} kind='artists' layout='phone' />
  {/if}
{/if}

<!--
  曲库的“专辑”标签：收藏的专辑，两列封面网格。
  手机上在曲库的文字标签下面；桌面没有标签（首页已经有专辑架子），直接打开这个地址时照样显示。返回这一页时滚动位置回到原来的样子
-->
<script lang='ts'>
  import { getAppView } from '#lib/components/app-context.svelte.js'
  import { desktopLayout } from '#lib/components/layout.js'
  import CollectedGrid from '#lib/components/library/CollectedGrid.svelte'
  import SyncNotice from '#lib/components/library/SyncNotice.svelte'
  import { formatCount } from '#lib/components/library/view.js'
  import { fade } from '#lib/components/motion.js'
  import { scrollSnapshot } from '#lib/components/snapshot.js'

  const view = getAppView()
  const library = $derived(view.state.library)
  export const snapshot = scrollSnapshot(() => null, () => {})
</script>

<svelte:head><title>专辑 · Campanula</title></svelte:head>

{#if library}
  {#if desktopLayout.current}
    <SyncNotice {library} failureShown={library.albums === null} />
    <div class='mb-4 mt-6 flex items-center gap-3'>
      <h1 class='text-headline text-neutral-900 font-600'>专辑</h1>
      {#if library.albums}<span class='text-caption text-neutral-500 tabular-nums' in:fade>{formatCount(library.albums.length)} 张</span>{/if}
    </div>
    <CollectedGrid {library} kind='albums' layout='grid' />
  {:else}
    <h1 class='sr-only'>专辑</h1>
    <SyncNotice {library} failureShown={library.albums === null} phone />
    <CollectedGrid {library} kind='albums' layout='phone' />
  {/if}
{/if}

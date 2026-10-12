<!--
  曲库的“歌单”标签：自建的、收藏的歌单，能按 全部 / 自建 / 收藏 筛选。
  手机上在曲库的文字标签下面；桌面没有标签（首页已经有歌单区块），直接打开这个地址时照样显示。
  返回这一页时，筛选和滚动位置都回到原来的样子
-->
<script lang='ts'>
  import type { PlaylistFilter } from '$lib/components/library/view'
  import { getAppView } from '$lib/components/app-context.svelte'
  import { desktopLayout } from '$lib/components/layout'
  import PlaylistGrid from '$lib/components/library/PlaylistGrid.svelte'
  import SyncNotice from '$lib/components/library/SyncNotice.svelte'
  import { scrollSnapshot } from '$lib/components/snapshot'

  const view = getAppView()
  const library = $derived(view.state.library)

  let filter = $state<PlaylistFilter>('all')
  export const snapshot = scrollSnapshot(() => filter, (value) => {
    filter = value
  })
</script>

<svelte:head><title>歌单 · Campanula</title></svelte:head>

{#if library}
  {#if desktopLayout.current}
    <SyncNotice library={library} failureShown={library.playlists === null} />
    <div class='mt-6'>
      <PlaylistGrid {library} bind:filter>
        {#snippet heading()}
          <h1 class='text-headline text-neutral-900 font-600'>歌单</h1>
        {/snippet}
      </PlaylistGrid>
    </div>
  {:else}
    <h1 class='sr-only'>歌单</h1>
    <SyncNotice {library} failureShown={library.playlists === null} phone />
    <PlaylistGrid {library} bind:filter phone />
  {/if}
{/if}

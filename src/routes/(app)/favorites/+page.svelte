<script lang='ts'>
  import SongRow from '$lib/components/common/SongRow.svelte'
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'
  import { likedError, likedLoading, likedSongs, loadLikedSongs } from '$lib/stores'
  import { Heart, Loader } from 'lucide-svelte'
  import { onMount } from 'svelte'

  const metadata = generateSeoMetadata('favorites')

  // 喜欢列表为全局单一数据源（红心按钮首次出现即会触发加载，此处兜底确保页面就绪）
  onMount(() => {
    void loadLikedSongs()
  })
</script>

<SeoHead {metadata} />

<section class='space-y-6'>
  <header class='flex items-center gap-4'>
    <span class='size-20 flex shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-600'>
      <Heart class='size-9' />
    </span>
    <div class='min-w-0'>
      <h1 class='text-2xl text-app-text font-semibold'>我喜欢的音乐</h1>
      <p class='mt-1 text-sm text-app-text-muted'>
        {$likedSongs.length > 0 ? `${$likedSongs.length} 首红心歌曲 · 按红心时间倒序` : '你红心过的每一首歌都在这里'}
      </p>
    </div>
  </header>

  {#if $likedLoading}
    <div class='flex items-center justify-center gap-2 py-12 text-sm text-app-text-muted'>
      <Loader class='size-5 animate-spin' />
      加载中…
    </div>
  {:else if $likedError}
    <div role='alert' class='border border-error-200 rounded-xl bg-error/5 px-4 py-3 text-sm text-error-700'>
      {$likedError}
    </div>
  {:else if $likedSongs.length === 0}
    <p class='py-12 text-center text-sm text-app-text-muted'>还没有红心歌曲，去播放器或歌曲列表点一下红心吧</p>
  {:else}
    <ul role='list' class='space-y-1'>
      {#each $likedSongs as song (song.id)}
        <SongRow {song} />
      {/each}
    </ul>
  {/if}
</section>

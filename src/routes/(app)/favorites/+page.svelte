<script lang='ts'>
  import Input from '$lib/components/hana/Input.svelte'
  import SongList from '$lib/components/playlists/SongList.svelte'
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'
  import { toSongItem } from '$lib/ncm/songs'
  import { likedError, likedLoading, likedSongs, loadLikedSongs } from '$lib/stores'
  import { Heart, Loader, Search, X } from '@lucide/svelte'
  import { onMount } from 'svelte'

  const metadata = generateSeoMetadata('favorites')

  let searchValue = $state('')

  // 喜欢列表为全局单一数据源（红心按钮首次出现即会触发加载，此处兜底确保页面就绪）
  onMount(() => {
    void loadLikedSongs()
  })

  const songs = $derived($likedSongs.map(toSongItem))
</script>

<SeoHead {metadata} />

<section class='h-[calc(100dvh-15rem)] flex flex-col gap-6 md:h-[calc(100dvh-9.5rem)]'>
  <header class='flex items-center gap-4'>
    <span class='size-20 flex shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-600'>
      <Heart class='size-9' />
    </span>
    <div class='min-w-0'>
      <h1 class='text-2xl text-app-text font-semibold'>我喜欢的音乐</h1>
      {#if songs.length > 0}
        <p class='mt-1 text-sm text-app-text-muted'>{songs.length} 首歌曲</p>
      {/if}
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
  {:else if songs.length === 0}
    <p class='py-12 text-center text-sm text-app-text-muted'>还没有红心歌曲</p>
  {:else}
    <div class='min-h-0 w-full flex flex-1 flex-col gap-6'>
      <Input
        type='text'
        shape='rounded'
        size='md'
        placeholder='搜索我喜欢的音乐…'
        bind:value={searchValue}
      >
        {#snippet prefixIcon()}
          <Search size={16} />
        {/snippet}
        {#snippet suffixIcon()}
          {#if searchValue}
            <button
              type='button'
              class='rounded-md p-1 hover:bg-neutral-100'
              aria-label='清空搜索'
              onclick={() => (searchValue = '')}
            >
              <X class='size-4' />
            </button>
          {/if}
        {/snippet}
      </Input>
      <!-- 弹性高度：列表填满头部以下剩余空间（VirtualList 依赖有界容器） -->
      <div class='min-h-40 flex-1'>
        <SongList {songs} {searchValue} playlistId='liked' />
      </div>
    </div>
  {/if}
</section>

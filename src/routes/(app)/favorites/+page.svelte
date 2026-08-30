<script lang='ts'>
  import type { SongItem } from '$lib/types'
  import type { PageProps } from './$types'
  import Input from '$lib/components/hana/Input.svelte'
  import SongList from '$lib/components/playlists/SongList.svelte'
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'
  import { fetchLikedPage, fetchLikedSongs, LIKED_PAGE_SIZE } from '$lib/ncm/likes'
  import { toSongItem } from '$lib/ncm/songs'
  import { likedIds, likedLoaded } from '$lib/stores'
  import { Heart, Search, X } from '@lucide/svelte'

  const { data }: PageProps = $props()

  const metadata = generateSeoMetadata('favorites')

  /** 客户端增量状态：触底追加的后续页曲目（首屏页随 load 经 data 原子更新，不落本地状态） */
  const moreSongs = $state<SongItem[]>([])
  /** 已请求到的曲目偏移：按请求窗口推进，不随下架缺曲回退，避免窗口重叠 */
  let nextOffset = $state(LIKED_PAGE_SIZE)
  let loadingMore = $state(false)
  let searchValue = $state('')

  const songs = $derived(
    [...data.firstPage.map(toSongItem), ...moreSongs]
      .filter(song => !$likedLoaded || $likedIds.has(song.id)),
  )

  /** 触底增量加载下一页（失败不破坏已有内容，可再次滚动重试） */
  const loadMore = async () => {
    if (data.error || loadingMore || nextOffset >= data.total)
      return
    loadingMore = true
    try {
      const offset = nextOffset
      const next = await fetchLikedPage({ limit: LIKED_PAGE_SIZE, offset })
      nextOffset = offset + LIKED_PAGE_SIZE
      const seen = new Set([...data.firstPage, ...moreSongs].map(song => song.id))
      moreSongs.push(...next.songs.map(toSongItem).filter(song => !seen.has(song.id)))
    }
    catch (err) {
      console.error('加载更多失败', err)
    }
    finally {
      loadingMore = false
    }
  }

  /** 播放全部/双击入队前补全整份红心列表：一次全量拉取后归并进本地列表 */
  const ensureAllSongs = async (): Promise<SongItem[]> => {
    if (data.error || nextOffset >= data.total)
      return songs
    try {
      const all = await fetchLikedSongs()
      nextOffset = data.total
      const seen = new Set([...data.firstPage, ...moreSongs].map(song => song.id))
      moreSongs.push(...all.map(toSongItem).filter(song => !seen.has(song.id)))
    }
    catch (err) {
      // 补全失败退回已加载部分，队列至少覆盖已浏览内容
      console.error('补全红心队列失败', err)
    }
    return songs
  }
</script>

<SeoHead {metadata} />

{#if data.error}
  <div role='alert' class='border border-error-200 rounded-xl bg-error/5 px-4 py-3 text-sm text-error-700'>
    {data.error}
  </div>
{:else}
  <section class='h-[calc(100dvh-15rem)] flex flex-col gap-6 md:h-[calc(100dvh-9.5rem)]'>
    <header class='flex items-center gap-4'>
      <span class='size-20 flex shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-600'>
        <Heart class='size-9' />
      </span>
      <div class='min-w-0'>
        <h1 class='text-2xl text-app-text font-semibold'>我喜欢的音乐</h1>
        {#if data.total > 0}
          <p class='mt-1 text-sm text-app-text-muted'>{data.total} 首歌曲</p>
        {/if}
      </div>
    </header>

    {#if songs.length === 0}
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
          <SongList
            {songs}
            {searchValue}
            playlistId='liked'
            onQueueAll={ensureAllSongs}
            onNearEnd={loadMore}
            loading={loadingMore}
          />
        </div>
      </div>
    {/if}
  </section>
{/if}

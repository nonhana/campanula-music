<script lang='ts'>
  import type { NcmPlaylistDetail, NcmSong, PlaylistItem, SongItem } from '$lib/types'
  import { page } from '$app/state'
  import Detail from '$lib/components/playlists/Detail.svelte'
  import SongList from '$lib/components/playlists/SongList.svelte'
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'
  import { NcmClientError } from '$lib/ncm/client'
  import { fetchPlaylistDetail, fetchPlaylistTracks, PLAYLIST_ERROR_TEXT } from '$lib/ncm/playlists'
  import { toSongItem } from '$lib/ncm/songs'
  import { Loader } from '@lucide/svelte'

  const metadata = generateSeoMetadata('playlistDetail')

  // 浏览用分页大小：首屏并行取头信息与第一页，其余触底增量加载
  const PAGE_SIZE = 100
  // 队列补全分页大小：与单请求 id 分片上限一致，整张歌单补全按 1000 首并行拉取
  const QUEUE_CHUNK = 1000

  const playlistId = $derived(Number(page.params.id))

  let detail = $state<NcmPlaylistDetail | null>(null)
  let songs = $state<SongItem[]>([])
  /** 已请求到的曲目偏移：按请求窗口推进，不随下架缺曲回退，避免窗口重叠 */
  let nextOffset = $state(0)
  let loading = $state(true)
  let loadingMore = $state(false)
  let errorMessage = $state<string | null>(null)
  let controller: AbortController | null = null

  // 路由歌单 id 变化（初次挂载与歌单间跳转）时重置并重新加载
  $effect(() => {
    controller?.abort()
    controller = new AbortController()
    nextOffset = 0
    void load(playlistId)
    return () => controller?.abort()
  })

  async function load(id: number) {
    loading = true
    loadingMore = false
    detail = null
    songs = []
    try {
      const [header, firstPage] = await Promise.all([
        fetchPlaylistDetail(id, controller?.signal),
        fetchPlaylistTracks(id, { limit: PAGE_SIZE, offset: 0 }, controller?.signal),
      ])
      if (controller?.signal.aborted)
        return
      detail = header
      nextOffset = PAGE_SIZE
      songs = firstPage.map(toSongItem)
      errorMessage = null
    }
    catch (err) {
      if (controller?.signal.aborted)
        return
      detail = null
      songs = []
      errorMessage = err instanceof NcmClientError
        ? (err.message || PLAYLIST_ERROR_TEXT[err.code])
        : PLAYLIST_ERROR_TEXT.UNKNOWN
    }
    finally {
      if (!controller?.signal.aborted)
        loading = false
    }
  }

  /** 触底增量加载下一页（失败不破坏已有内容，可再次滚动重试） */
  async function loadMore() {
    if (!detail || loading || loadingMore || nextOffset >= detail.trackCount)
      return
    loadingMore = true
    try {
      const offset = nextOffset
      const next = await fetchPlaylistTracks(playlistId, { limit: PAGE_SIZE, offset }, controller?.signal)
      if (controller?.signal.aborted)
        return
      nextOffset = offset + PAGE_SIZE
      const seen = new Set(songs.map(song => song.id))
      songs.push(...next.map(toSongItem).filter(song => !seen.has(song.id)))
    }
    catch (err) {
      console.error('加载更多失败', err)
    }
    finally {
      loadingMore = false
    }
  }

  /** 播放全部/双击入队前补全整张歌单：并行拉取剩余分页后按歌单顺序归并 */
  async function ensureAllSongs(): Promise<SongItem[]> {
    if (!detail || nextOffset >= detail.trackCount)
      return songs
    const target = detail.trackCount
    const pages: Promise<NcmSong[]>[] = []
    for (let offset = nextOffset; offset < target; offset += QUEUE_CHUNK)
      pages.push(fetchPlaylistTracks(playlistId, { limit: QUEUE_CHUNK, offset }, controller?.signal))
    try {
      const fetched = await Promise.all(pages)
      if (controller?.signal.aborted)
        return songs
      const seen = new Set(songs.map(song => song.id))
      songs.push(
        ...fetched
          .flatMap(page => page.map(toSongItem))
          .filter(song => !seen.has(song.id)),
      )
      nextOffset = target
    }
    catch (err) {
      // 补全失败退回已加载部分，队列至少覆盖已浏览内容
      console.error('补全歌单队列失败', err)
    }
    return songs
  }

  let searchValue = $state('')

  // 领域形状适配：歌单头 → 旧富视图 PlaylistItem，歌曲 → 播放链路 SongItem
  const playlistItem = $derived(detail
    ? {
      id: detail.id,
      name: detail.name,
      description: detail.description,
      musicCount: detail.trackCount,
      cover: detail.cover,
      sourceId: String(detail.id),
    } satisfies PlaylistItem
    : null)
</script>

<SeoHead {metadata} />

{#if loading}
  <div class='flex items-center justify-center gap-2 py-12 text-sm text-app-text-muted'>
    <Loader class='size-5 animate-spin' />
    加载中…
  </div>
{:else if errorMessage}
  <div role='alert' class='border border-error-200 rounded-xl bg-error/5 px-4 py-3 text-sm text-error-700'>
    {errorMessage}
  </div>
{:else if detail && playlistItem}
  <!-- 定高根：扣去顶部留白与底部播放栏，列表在根内 flex-1 自适应头部实际高度 -->
  <div class='h-[calc(100dvh-15rem)] w-full flex flex-col gap-8 md:h-[calc(100dvh-9.5rem)]'>
    <Detail {songs} playlist={playlistItem} bind:searchValue onQueueAll={ensureAllSongs} />
    {#if songs.length === 0}
      <p class='py-12 text-center text-sm text-app-text-muted'>这个歌单还没有歌曲</p>
    {:else}
      <!-- 弹性高度：列表填满头部以下剩余空间（VirtualList 依赖有界容器） -->
      <div class='min-h-40 flex-1'>
        <SongList {songs} {searchValue} onQueueAll={ensureAllSongs} onNearEnd={loadMore} />
      </div>
      {#if loadingMore}
        <p class='py-2 text-center text-sm text-app-text-muted'>加载中…</p>
      {/if}
    {/if}
  </div>
{/if}

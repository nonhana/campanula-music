<script lang='ts'>
  import type { NcmSong, PlaylistItem, SongItem } from '$lib/types'
  import type { PageProps } from './$types'
  import { afterNavigate } from '$app/navigation'
  import { page } from '$app/state'
  import Detail from '$lib/components/playlists/Detail.svelte'
  import SongList from '$lib/components/playlists/SongList.svelte'
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'
  import { fetchPlaylistTracks, PLAYLIST_PAGE_SIZE, PLAYLIST_QUEUE_CHUNK } from '$lib/ncm/playlists'
  import { toSongItem } from '$lib/ncm/songs'

  const { data }: PageProps = $props()

  const metadata = generateSeoMetadata('playlistDetail')

  const playlistId = $derived(Number(page.params.id))

  /** 客户端增量状态：触底追加的后续页曲目（首屏页随 load 经 data 原子更新，不落本地状态） */
  let moreSongs = $state<SongItem[]>([])
  /** 已请求到的曲目偏移：按请求窗口推进，不随下架缺曲回退，避免窗口重叠 */
  let nextOffset = $state(PLAYLIST_PAGE_SIZE)
  let loadingMore = $state(false)
  let searchCompleting = $state(false)
  let searchValue = $state('')

  // 路由歌单 id 变化（歌单间跳转）时重置增量状态并清空过滤词；首次进入同样归位。
  // load 期间 data 保持旧歌单内容，切歌单不闪「加载中/错误」态
  afterNavigate((navigation) => {
    if (navigation.to?.params?.id != null && navigation.to.params.id === navigation.from?.params?.id)
      return
    nextOffset = PLAYLIST_PAGE_SIZE
    moreSongs = []
    loadingMore = false
    searchValue = ''
  })

  /** 已加载歌曲：首屏页 + 客户端增量页，按歌单顺序 */
  const songs = $derived([...data.firstPage.map(toSongItem), ...moreSongs])

  /** 触底增量加载下一页（失败不破坏已有内容，可再次滚动重试） */
  const loadMore = async () => {
    if (!data.detail || loadingMore || nextOffset >= data.detail.trackCount)
      return
    // 闭包捕获发起时的歌单：await 期间切到其他歌单则响应整页丢弃，不写回状态
    const id = playlistId
    loadingMore = true
    try {
      const offset = nextOffset
      const next = await fetchPlaylistTracks(id, { limit: PLAYLIST_PAGE_SIZE, offset })
      if (id !== playlistId)
        return
      nextOffset = offset + PLAYLIST_PAGE_SIZE
      const seen = new Set(songs.map(song => song.id))
      moreSongs.push(...next.map(toSongItem).filter(song => !seen.has(song.id)))
    }
    catch (err) {
      console.error('加载更多失败', err)
    }
    finally {
      if (id === playlistId)
        loadingMore = false
    }
  }

  /** 播放全部/双击入队前补全整张歌单：并行拉取剩余分页后按歌单顺序归并 */
  const ensureAllSongs = async () => {
    if (!data.detail || nextOffset >= data.detail.trackCount)
      return songs
    const id = playlistId
    const target = data.detail.trackCount
    const pages: Promise<NcmSong[]>[] = []
    for (let offset = nextOffset; offset < target; offset += PLAYLIST_QUEUE_CHUNK)
      pages.push(fetchPlaylistTracks(id, { limit: PLAYLIST_QUEUE_CHUNK, offset }))
    try {
      const fetched = await Promise.all(pages)
      if (id !== playlistId)
        return songs
      const seen = new Set(songs.map(song => song.id))
      moreSongs.push(
        ...fetched
          .flatMap(fetchedPage => fetchedPage.map(toSongItem))
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

  /** 搜索需覆盖未加载部分：输入非空时补全整张歌单（与入队补全共用链路），完成后过滤即覆盖全量 */
  $effect(() => {
    if (!searchValue.trim() || !data.detail)
      return
    if (nextOffset >= data.detail.trackCount || searchCompleting)
      return
    searchCompleting = true
    ensureAllSongs().finally(() => {
      searchCompleting = false
    })
  })

  // 领域形状适配：歌单头 → 旧富视图 PlaylistItem
  const playlistItem = $derived(data.detail
    ? {
      id: data.detail.id,
      name: data.detail.name,
      description: data.detail.description,
      musicCount: data.detail.trackCount,
      cover: data.detail.cover,
      sourceId: String(data.detail.id),
    } satisfies PlaylistItem
    : null)
</script>

<SeoHead {metadata} />

{#if data.error}
  <div role='alert' class='border border-error-200 rounded-xl bg-error/5 px-4 py-3 text-sm text-error-700'>
    {data.error}
  </div>
{:else if playlistItem}
  <!-- 定高根：扣去顶部留白与底部播放栏，列表在根内 flex-1 自适应头部实际高度 -->
  <div class='h-[calc(100dvh-15rem)] w-full flex flex-col gap-8 md:h-[calc(100dvh-9.5rem)]'>
    <Detail {songs} playlist={playlistItem} bind:searchValue onQueueAll={ensureAllSongs} />
    {#if songs.length === 0}
      <p class='py-12 text-center text-sm text-app-text-muted'>这个歌单还没有歌曲</p>
    {:else}
      <!-- 弹性高度：列表填满头部以下剩余空间（VirtualList 依赖有界容器） -->
      <div class='min-h-40 flex-1'>
        <SongList {songs} {searchValue} onQueueAll={ensureAllSongs} onNearEnd={loadMore} loading={loadingMore || searchCompleting} />
      </div>
    {/if}
  </div>
{/if}

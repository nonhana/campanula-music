<script lang='ts'>
  import type { SongItem } from '$lib/types'
  import { page } from '$app/state'
  import SongPlaylistItem from '$lib/components/common/SongPlaylistItem.svelte'
  import ScrollContainer from '$lib/components/hana/ScrollContainer.svelte'
  import VirtualList from '$lib/components/hana/VirtualList.svelte'
  import { useMessage } from '$lib/hooks/useMessage'
  import { playlistId as playlistIdStore, resetPlaylist, setNowPlaying, setPlaylistId, setSongLoading, updatePlaylist } from '$lib/stores'

  const { callHanaMessage } = useMessage()

  interface Props {
    songs: SongItem[]
    searchValue: string
    /** 队列守卫标识：非路由歌单（如红心页）传入固定 id，缺省沿用路由歌单 id */
    playlistId?: string
    /** 切换队列前补全整张歌单（分页懒加载下队列必须完整）；缺省直接用已加载歌曲 */
    onQueueAll?: () => Promise<SongItem[]>
    /** 触底增量加载回调，透传给 VirtualList 的 onNearEnd */
    onNearEnd?: () => void
  }

  let { songs, searchValue = $bindable(''), playlistId, onQueueAll, onNearEnd }: Props = $props()

  const songsFilter = (song: SongItem) => {
    const target = searchValue.trim().toLowerCase()
    return song.name.toLowerCase().includes(target)
      || song.album.name.toLowerCase().includes(target)
      || song.alias.some(alias => alias.toLowerCase().includes(target))
      || song.artists.some(artist => artist.name.toLowerCase().includes(target))
  }

  const songList = $derived(songs.filter(songsFilter).map((song, index) => ({
    ...song,
    index,
  })))

  let scrollOffset = $state(0)

  const scrollWatcher = (offset: number) => {
    scrollOffset = offset
  }

  let containerSize = $state(0)

  const onHeightChange = (height: number) => {
    containerSize = height
  }

  // 队列守卫标识：非路由歌单（如红心页）传入固定 id，缺省沿用路由歌单 id
  const curPlaylistId = $derived(playlistId ?? page.params.id)

  const handleDblClick = async (targetSong: SongItem) => {
    try {
      setSongLoading(true)
      if (curPlaylistId && curPlaylistId !== $playlistIdStore) {
        resetPlaylist()
        setPlaylistId(curPlaylistId)
        // 浏览按分页懒加载，切换队列前补全整张歌单，保证队列完整
        const queue = await onQueueAll?.() ?? songs
        updatePlaylist(queue)
        callHanaMessage({
          message: '播放列表已更新',
          type: 'success',
        })
      }
      setNowPlaying(targetSong)
    }
    catch (error: any) {
      callHanaMessage({
        message: error.message,
        type: 'error',
      })
    }
  }
</script>

<ScrollContainer ariaLabel='歌曲列表' {scrollWatcher} {onHeightChange}>
  <VirtualList items={songList} itemSize={72} {containerSize} scrollPos={scrollOffset} {onNearEnd}>
    {#snippet renderItem(item)}
      <SongPlaylistItem showCover index={item.index + 1} song={item} ondblclick={() => handleDblClick(item)} />
    {/snippet}
  </VirtualList>
</ScrollContainer>

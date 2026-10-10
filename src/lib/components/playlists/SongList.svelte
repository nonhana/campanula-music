<script lang='ts'>
  import type { SongItem } from '$lib/types'
  import { page } from '$app/state'
  import SongPlaylistItem from '$lib/components/common/SongPlaylistItem.svelte'
  import ScrollContainer from '$lib/components/hana/ScrollContainer.svelte'
  import VirtualList from '$lib/components/hana/VirtualList.svelte'
  import { useMessage } from '$lib/hooks/useMessage'
  import { playlistId, resetPlaylist, setNowPlaying, setPlaylistId, setSongLoading, updatePlaylist } from '$lib/stores'

  const { callHanaMessage } = useMessage()

  interface Props {
    songs: SongItem[]
    searchValue: string
  }

  let { songs, searchValue = $bindable('') }: Props = $props()

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

  const handleDblClick = (targetSong: SongItem) => {
    const curPlaylistId = page.params.id
    try {
      setSongLoading(true)
      if (curPlaylistId && curPlaylistId !== $playlistId) {
        resetPlaylist()
        setPlaylistId(curPlaylistId)
        updatePlaylist(songs)
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

<ScrollContainer {scrollWatcher} {onHeightChange}>
  <VirtualList items={songList} itemSize={72} {containerSize} scrollPos={scrollOffset}>
    {#snippet renderItem(item)}
      <SongPlaylistItem showCover index={item.index + 1} song={item} ondblclick={() => handleDblClick(item)} />
    {/snippet}
  </VirtualList>
</ScrollContainer>

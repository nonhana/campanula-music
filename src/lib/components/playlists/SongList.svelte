<script lang='ts'>
  import type { SongItem } from '$lib/types'
  import SongPlaylistItem from '$lib/components/common/SongPlaylistItem.svelte'
  import ScrollContainer from '$lib/components/hana/ScrollContainer.svelte'
  import VirtualList from '$lib/components/hana/VirtualList.svelte'

  interface Props {
    songs: SongItem[]
  }

  const { songs }: Props = $props()

  const songList = $derived(songs.map((song, index) => ({
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
</script>

<ScrollContainer {scrollWatcher} {onHeightChange}>
  <VirtualList items={songList} itemSize={72} {containerSize} scrollPos={scrollOffset}>
    {#snippet renderItem(item)}
      <SongPlaylistItem showCover index={item.index + 1} song={item} />
    {/snippet}
  </VirtualList>
</ScrollContainer>

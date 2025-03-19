<script lang='ts'>
  import SongPlaylistItem from '$lib/components/common/SongPlaylistItem.svelte'
  import VirtualList from '$lib/components/hana/VirtualList.svelte'
  import { nowPlaying, playlist } from '$lib/stores'

  const indexedPlaylist = $derived($playlist.map((item, index) => ({ ...item, index })))

  const getItemById = (id: number | string) => indexedPlaylist.find(item => item.id === id) ?? null
</script>

<VirtualList
  items={indexedPlaylist}
  containerSize={640}
  itemSize={72}
  activeItemId={$nowPlaying?.id}
  {getItemById}
>
  {#snippet renderItem(item)}
    <SongPlaylistItem index={item.index + 1} song={item} type='queue' />
  {/snippet}
</VirtualList>

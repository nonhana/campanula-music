<script lang='ts'>
  import SongPlaylistItem from '$lib/components/common/SongPlaylistItem.svelte'
  import VirtualList from '$lib/components/hana/VirtualList.svelte'
  import { nowPlaying, playlist } from '$lib/stores'

  const getItemById = (id: number | string) => $playlist.find(item => item.id === id) ?? null
</script>

<VirtualList
  items={$playlist}
  containerSize={640}
  itemSize={72}
  activeItemId={$nowPlaying?.id}
  {getItemById}
>
  {#snippet renderItem(item)}
    <SongPlaylistItem index={item.id} song={item} type='queue' />
  {/snippet}
</VirtualList>

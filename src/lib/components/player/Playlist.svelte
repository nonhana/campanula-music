<script lang='ts'>
  import SongPlaylistItem from '$lib/components/common/SongPlaylistItem.svelte'
  import VirtualList from '$lib/components/hana/VirtualList.svelte'
  import { nowPlaying, playlist } from '$lib/stores'
</script>

<VirtualList
  items={$playlist}
  containerSize={640}
  itemSize={72}
  activeItemId={$nowPlaying?.id}
>
  {#snippet renderItem(item)}
    <SongPlaylistItem index={item.id} song={item} type='queue' />
  {/snippet}
</VirtualList>

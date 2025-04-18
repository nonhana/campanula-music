<script lang='ts'>
  import SongPlaylistItem from '$lib/components/common/SongPlaylistItem.svelte'
  import VirtualList from '$lib/components/hana/VirtualList.svelte'
  import { nowPlaying, playlist, setNowPlaying } from '$lib/stores'

  const indexedPlaylist = $derived($playlist.map((item, index) => ({ ...item, index })))

  const getItemById = (id: number | string) => indexedPlaylist.find(item => item.id === id) ?? null
</script>

{#if $playlist.length > 0}
  <VirtualList
    items={indexedPlaylist}
    containerSize={640}
    itemSize={72}
    activeItemId={$nowPlaying?.id}
    {getItemById}
  >
    {#snippet renderItem(item)}
      <SongPlaylistItem index={item.index + 1} song={item} type='queue' ondblclick={() => setNowPlaying(item)} />
    {/snippet}
  </VirtualList>
{:else}
  <div class='size-full flex items-center justify-center text-neutral'>
    <span>当前歌单为空，请添加歌曲</span>
  </div>
{/if}

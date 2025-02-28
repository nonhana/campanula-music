<script lang='ts'>
  import SongPlaylistItem from '$lib/components/common/SongPlaylistItem.svelte'
  import ScrollContainer from '$lib/components/hana/ScrollContainer.svelte'
  import { mockSongs } from '$lib/mock'
</script>

<ScrollContainer contentClass='w-full max-h-[50rem] px-5 flex flex-col gap-2'>
  {#each mockSongs as song, index}
    <SongPlaylistItem index={index + 1} song={song} />
  {/each}
</ScrollContainer>

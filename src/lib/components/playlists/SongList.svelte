<script lang='ts'>
  import ScrollContainer from '$lib/components/hana/ScrollContainer.svelte'
  import { mockSongs } from '$lib/mock'
  import SongItem from './SongItem.svelte'
</script>

<ScrollContainer contentClass='w-full max-h-[50rem] px-5 flex flex-col gap-2'>
  {#each mockSongs as song, index}
    <SongItem index={index + 1} song={song} />
  {/each}
</ScrollContainer>

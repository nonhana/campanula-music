<script lang='ts'>
  import type { SongItem } from '$lib/types'
  import SongPlaylistItem from '$lib/components/common/SongPlaylistItem.svelte'
  import ScrollContainer from '$lib/components/hana/ScrollContainer.svelte'

  interface Props {
    songs: SongItem[]
  }

  const { songs }: Props = $props()
</script>

<ScrollContainer contentClass='w-full flex flex-col gap-2'>
  {#each songs as song, index}
    <SongPlaylistItem index={index + 1} song={song} />
  {/each}
</ScrollContainer>

<script lang='ts'>
  import type { SongItem } from '$lib/types'
  import { page } from '$app/state'
  import SongPlaylistItem from '$lib/components/common/SongPlaylistItem.svelte'
  import ScrollContainer from '$lib/components/hana/ScrollContainer.svelte'

  const id = $derived(page.params.id)

  let songs = $state<SongItem[]>([])
  const fetchSongs = async () => {
    const res = await fetch(`/api/playlists/${id}/songs`)
    const data = await res.json()
    songs = data
  }
  $effect(() => {
    fetchSongs()
  })
</script>

<ScrollContainer contentClass='w-full max-h-[50rem] px-5 flex flex-col gap-2'>
  {#each songs as song, index}
    <SongPlaylistItem index={index + 1} song={song} />
  {/each}
</ScrollContainer>

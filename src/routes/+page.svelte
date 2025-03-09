<script lang='ts'>
  import type { PageData } from './$types'
  import PlaylistList from '$lib/components/home/PlaylistList.svelte'
  import SongList from '$lib/components/home/SongList.svelte'

  interface Props {
    data: PageData
  }

  const { data }: Props = $props()
</script>

<svelte:head>
  <title>Home</title>
  <meta name='description' content='Svelte demo app' />
</svelte:head>

<SongList />
<PlaylistList playlists={data.playlists} />

<script lang='ts'>
  import type { PageData } from './$types'
  import Detail from '$lib/components/playlists/Detail.svelte'
  import SongList from '$lib/components/playlists/SongList.svelte'

  interface Props {
    data: PageData
  }

  const { data }: Props = $props()
</script>

<div class='w-full flex flex-col gap-8'>
  <Detail playlist={data.curPlaylist} />
  <SongList songs={data.curPlaylistSongs} />
</div>

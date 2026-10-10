<script lang='ts'>
  import type { PageData } from './$types'
  import PlaylistList from '$lib/components/home/PlaylistList.svelte'
  import SongList from '$lib/components/home/SongList.svelte'
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'

  interface Props {
    data: PageData
  }

  const { data }: Props = $props()

  const metadata = generateSeoMetadata('home')
</script>

<SeoHead {metadata} />

<SongList songList={data.songList} />
<PlaylistList playlists={data.playlists} />

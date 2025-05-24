<script lang='ts'>
  import type { PageData } from './$types'
  import Detail from '$lib/components/playlists/Detail.svelte'
  import SongList from '$lib/components/playlists/SongList.svelte'
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'

  interface Props {
    data: PageData
  }

  const { data }: Props = $props()

  const metadata = generateSeoMetadata('playlists', {
    title: `${data.curPlaylist.name} | Campanula Music`,
    description: `欣赏歌单"${data.curPlaylist.name}"，包含${data.curPlaylistSongs.length}首精选歌曲`,
    keywords: `歌单,${data.curPlaylist.name},音乐,Campanula`,
  })
</script>

<SeoHead {metadata} />

<div class='w-full flex flex-col gap-8'>
  <Detail playlist={data.curPlaylist} />
  <SongList songs={data.curPlaylistSongs} />
</div>

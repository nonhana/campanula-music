<script lang='ts'>
  import type { PlaylistItem, SongItem } from '$lib/types'
  import Card from '$lib/components/hana/Card.svelte'
  import LazyImage from '$lib/components/hana/LazyImage.svelte'
  import useMessage from '$lib/hooks/useMessage'
  import { setNowPlaying, setPlaylist } from '$lib/stores'
  import { PlayCircle } from 'lucide-svelte'

  const { callHanaMessage } = useMessage()

  interface Props {
    type?: 'home' | 'playlist'
    activated?: boolean
    playlist: PlaylistItem
    imgClass?: string
  }

  const { type = 'home', activated = false, playlist, imgClass = '' }: Props = $props()

  const fetchPlaylistSongs = async (): Promise<SongItem[]> => {
    const res = await fetch(`/api/playlists/${playlist.id}/songs`)
    const data = await res.json()
    return data
  }

  const handlePlayAll = async () => {
    try {
      const songs = await fetchPlaylistSongs()
      setPlaylist(songs)
      callHanaMessage({
        message: `成功添加 ${playlist.name} 的 ${songs.length} 首歌曲`,
        type: 'success',
      })
      await setNowPlaying(songs[0])
    }
    catch (error: any) {
      callHanaMessage({
        message: error.message,
        type: 'error',
      })
    }
  }
</script>

<Card
  elevated={false}
  divider={false}
  transparent
  href={type === 'playlist' ? `/playlists/${playlist.id}` : undefined}
  onclick={handlePlayAll}
>
  {#snippet mask()}
    <div
      class={[
        'z-1 absolute inset-0 size-full cursor-pointer hover:bg-gradient-to-b from-transparent to-primary/30 group/item',
        activated && 'bg-gradient-to-b from-transparent to-primary/30',
      ]}
    >
      <PlayCircle class={`text-neutral absolute bottom-2 right-2 hidden ${type === 'playlist' ? '' : 'group-hover/item:block'}`} />
    </div>
  {/snippet}
  {#snippet header()}
    <LazyImage
      src={playlist.cover ?? ''}
      alt={playlist.name}
      class={imgClass}
    />
  {/snippet}
  <div class={['flex flex-col items-start gap-2 p-2', type === 'playlist' && 'w-40']}>
    <span class='line-clamp-1 font-bold'>{playlist.name}</span>
    <span class='text-sm text-neutral'>{playlist.musicCount} 首</span>
  </div>
</Card>

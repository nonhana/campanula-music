<script lang='ts'>
  import type { PlaylistItem, SongItem } from '$lib/types'
  import Card from '$lib/components/hana/Card.svelte'
  import useMessage from '$lib/hooks/useMessage'
  import { mockSongs } from '$lib/mock'
  import { setNowPlaying, setPlaylist } from '$lib/stores'
  import { PlayCircle } from 'lucide-svelte'

  const { callHanaMessage } = useMessage()

  interface Props {
    type?: 'home' | 'playlist'
    activated?: boolean
    playlist: PlaylistItem
  }

  const { type = 'home', activated = false, playlist }: Props = $props()

  // TODO: 现在还是 mock 数据，后续需要调用接口
  const fetchPlaylistSongs = async (): Promise<SongItem[]> => {
    return new Promise((res) => {
      setTimeout(() => {
        res(mockSongs)
      }, 1000)
    })
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
        'absolute inset-0 size-full cursor-pointer hover:bg-gradient-to-b from-transparent to-primary/30 group/item',
        activated && 'bg-gradient-to-b from-transparent to-primary/30',
      ]}
    >
      <PlayCircle class={`text-neutral absolute bottom-2 right-2 hidden ${type === 'playlist' ? '' : 'group-hover/item:block'}`} />
    </div>
  {/snippet}
  {#snippet header()}
    <img
      src={playlist.cover}
      alt={playlist.name}
      class={[type === 'playlist' && 'w-40']}
    />
  {/snippet}
  <div class='flex flex-col px-4 py-2'>
    <span class='text-lg font-bold'>{playlist.name}</span>
    <span class='text-sm text-neutral'>{playlist.description}</span>
  </div>
</Card>

<script lang='ts'>
  import type { PlaylistItem, SongItem } from '$lib/types'
  import { page } from '$app/state'
  import Button from '$lib/components/hana/Button.svelte'
  import Dropdown from '$lib/components/hana/Dropdown.svelte'
  import DropdownItem from '$lib/components/hana/DropdownItem.svelte'
  import DropdownMenu from '$lib/components/hana/DropdownMenu.svelte'
  import Tooltip from '$lib/components/hana/Tooltip.svelte'
  import useMessage from '$lib/hooks/useMessage'
  import { setNowPlaying, setPlaylist } from '$lib/stores'
  import { Ellipsis, Play, Plus } from 'lucide-svelte'

  const { callHanaMessage } = useMessage()

  const id = $derived(page.params.id)

  let playlist = $state<PlaylistItem>({
    id: 0,
    name: '',
    description: '',
    cover: null,
    musicCount: 0,
    sourceId: '',
  })
  const fetchPlaylist = async () => {
    const res = await fetch(`/api/playlists/${id}`)
    const data = await res.json()
    playlist = data
  }
  $effect(() => {
    fetchPlaylist()
  })

  const moreMap = [
    {
      icon: Plus,
      text: '添加到播放列表',
    },
  ]

  const fetchPlaylistSongs = async (): Promise<SongItem[]> => {
    const res = await fetch(`/api/playlists/${id}/songs`)
    const data = await res.json()
    return data
  }

  const handleAddPlaylistSongs = async (autoplay: boolean = false) => {
    try {
      const songs = await fetchPlaylistSongs()
      setPlaylist(songs)
      callHanaMessage({
        message: `成功添加 ${playlist.name} 的 ${songs.length} 首歌曲`,
        type: 'success',
      })
      if (autoplay) {
        await setNowPlaying(songs[0])
      }
    }
    catch (error: any) {
      callHanaMessage({
        message: error.message,
        type: 'error',
      })
    }
  }

  const handleCommand = async (command: string | number | object) => {
    switch (command) {
      case '添加到播放列表':
        handleAddPlaylistSongs()
        break
      default:
        break
    }
  }
</script>

<div class='w-64 flex flex-col items-center space-y-5'>
  <img
    src={playlist.cover}
    alt={`歌单 ${playlist.name} 的封面`}
    class='aspect-square w-64 rounded-lg'
  />
  <h2 class='w-80 text-center text-2xl font-semibold'>{playlist.name}</h2>
  <p class='w-full break-words text-center text-wrap text-neutral'>{playlist.description || '暂无描述'}</p>
  <p class='text-neutral'>{playlist.musicCount} 首歌曲</p>
  <div class='flex space-x-5'>
    <Tooltip content='播放全部'>
      <Button iconButton variant='secondary' shape='circle' onclick={() => handleAddPlaylistSongs(true)}>
        <Play />
      </Button>
    </Tooltip>
    <Dropdown oncommand={handleCommand}>
      <Button iconButton variant='secondary' shape='circle'>
        <Ellipsis />
      </Button>
      {#snippet dropdown()}
        <DropdownMenu>
          {#each moreMap as { icon: Icon, text }}
            <DropdownItem command={text}>
              {#snippet icon()}
                <Icon />
              {/snippet}
              {text}
            </DropdownItem>
          {/each}
        </DropdownMenu>
      {/snippet}
    </Dropdown>
  </div>
</div>

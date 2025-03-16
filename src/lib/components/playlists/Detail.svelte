<script lang='ts'>
  import type { PlaylistItem, SongItem } from '$lib/types'
  import { page } from '$app/state'
  import Button from '$lib/components/hana/Button.svelte'
  import Dropdown from '$lib/components/hana/Dropdown.svelte'
  import DropdownItem from '$lib/components/hana/DropdownItem.svelte'
  import DropdownMenu from '$lib/components/hana/DropdownMenu.svelte'
  import LazyImage from '$lib/components/hana/LazyImage.svelte'
  import useMessage from '$lib/hooks/useMessage'
  import { setNowPlaying, setPlaylist } from '$lib/stores'
  import { Ellipsis, Play, Plus } from 'lucide-svelte'

  const { callHanaMessage } = useMessage()

  const id = $derived(page.params.id)

  interface Props {
    playlist: PlaylistItem
  }

  const { playlist }: Props = $props()

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

<div class='flex gap-8'>
  <LazyImage
    src={playlist.cover ?? ''}
    alt={`歌单 ${playlist.name} 的封面`}
    class='aspect-square w-48 shrink-0 rounded-2xl'
  />
  <div class='flex flex-col justify-between'>
    <h2 class='text-2xl font-semibold'>{playlist.name}</h2>
    <p class='max-h-[76px] overflow-y-scroll break-words text-wrap text-neutral scrollbar-none'>{playlist.description || '暂无描述'}</p>
    <p class='text-neutral'>{playlist.musicCount} 首歌曲</p>
    <div class='flex space-x-5'>
      <Button variant='accent' onclick={() => handleAddPlaylistSongs(true)}>
        <span class='flex items-center gap-2'>
          <Play size={16} /> 播放全部
        </span>
      </Button>
      <Dropdown position='right' trigger='click' oncommand={handleCommand}>
        <Button iconButton variant='transparent'>
          <Ellipsis />
        </Button>
        {#snippet dropdown()}
          <DropdownMenu>
            {#each moreMap as { icon: Icon, text }}
              <DropdownItem command={text}>
                {#snippet icon()}
                  <Icon />
                {/snippet}
                <span>{text}</span>
              </DropdownItem>
            {/each}
          </DropdownMenu>
        {/snippet}
      </Dropdown>
    </div>
  </div>
</div>

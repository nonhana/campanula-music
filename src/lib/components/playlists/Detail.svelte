<script lang='ts'>
  import type { PlaylistItem, SongItem } from '$lib/types'
  import { page } from '$app/state'
  import Button from '$lib/components/hana/Button.svelte'
  import Dropdown from '$lib/components/hana/Dropdown.svelte'
  import DropdownItem from '$lib/components/hana/DropdownItem.svelte'
  import DropdownMenu from '$lib/components/hana/DropdownMenu.svelte'
  import LazyImage from '$lib/components/hana/LazyImage.svelte'
  import useMessage from '$lib/hooks/useMessage'
  import { setNowPlaying, setPlaylist, setSongLoading, songLoading } from '$lib/stores'
  import { Ellipsis, Loader, Play } from 'lucide-svelte'

  const { callHanaMessage } = useMessage()

  const id = $derived(page.params.id)

  interface Props {
    playlist: PlaylistItem
  }

  const { playlist }: Props = $props()

  const moreMap = [{
    text: '添加到播放列表',
    command: 'add-to-playlist',
  }]

  const fetchPlaylistSongs = async (): Promise<SongItem[]> => {
    const res = await fetch(`/api/playlists/${id}/songs`)
    const data = await res.json()
    return data
  }

  const handleAddPlaylistSongs = async (autoplay: boolean = false) => {
    try {
      setSongLoading(true)
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
    finally {
      !autoplay && setSongLoading(false)
    }
  }

  const handleCommand = async (command: string | number | object) => {
    switch (command) {
      case 'add-to-playlist':
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
    class='aspect-square w-32 shrink-0 rounded-2xl md:w-48'
  />
  <div class='flex flex-col justify-between'>
    <h2 class='text-2xl font-semibold'>{playlist.name}</h2>
    <p class='max-h-[76px] overflow-y-scroll break-words text-wrap text-neutral scrollbar-none'>{playlist.description ?? '暂无描述'}</p>
    <p class='text-neutral'>{playlist.musicCount} 首歌曲</p>
    <div class='flex space-x-5'>
      <Button variant='accent' onclick={() => handleAddPlaylistSongs(true)} disabled={$songLoading}>
        <span class='flex items-center gap-2'>
          {#if $songLoading}
            <Loader size={16} class='animate-spin' />
          {:else}
            <Play size={16} />
          {/if} 播放全部
        </span>
      </Button>
      <Dropdown position='bottom' trigger='click' oncommand={handleCommand}>
        <Button iconButton variant='transparent'>
          <Ellipsis />
        </Button>
        {#snippet dropdown()}
          <DropdownMenu>
            {#each moreMap as { text, command }}
              <DropdownItem command={command}>
                {text}
              </DropdownItem>
            {/each}
          </DropdownMenu>
        {/snippet}
      </Dropdown>
    </div>
  </div>
</div>

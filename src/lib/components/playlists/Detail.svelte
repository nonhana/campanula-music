<script lang='ts'>
  import type { SongItem } from '$lib/types'
  import Button from '$lib/components/hana/Button.svelte'
  import Dropdown from '$lib/components/hana/Dropdown/index.svelte'
  import DropdownItem from '$lib/components/hana/Dropdown/Item.svelte'
  import DropdownMenu from '$lib/components/hana/Dropdown/Menu.svelte'
  import Tooltip from '$lib/components/hana/Tooltip.svelte'
  import useMessage from '$lib/hooks/useMessage'
  import { mockPlaylist, mockSongs } from '$lib/mock'
  import { setNowPlaying, setPlaylist } from '$lib/stores'
  import { Ellipsis, Play, Plus } from 'lucide-svelte'

  const { callHanaMessage } = useMessage()

  const moreMap = [
    {
      icon: Plus,
      text: '添加到播放列表',
    },
  ]

  // TODO: 现在还是 mock 数据，后续需要调用接口
  const fetchPlaylistSongs = async (): Promise<SongItem[]> => {
    return new Promise((res) => {
      setTimeout(() => {
        res(mockSongs)
      }, 1000)
    })
  }

  const handleAddPlaylistSongs = async (autoplay: boolean = false) => {
    try {
      const songs = await fetchPlaylistSongs()
      setPlaylist(songs)
      callHanaMessage({
        message: `成功添加 ${mockPlaylist.name} 的 ${songs.length} 首歌曲`,
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
    src={mockPlaylist.cover}
    alt={`歌单 ${mockPlaylist.name} 的封面`}
    class='aspect-square w-64 rounded-lg'
  />
  <h2 class='w-80 text-center text-2xl font-semibold'>{mockPlaylist.name}</h2>
  <p class='w-full break-words text-center text-wrap text-neutral'>{mockPlaylist.description}</p>
  <p class='text-neutral'>{mockPlaylist.musicCount} 首歌曲</p>
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

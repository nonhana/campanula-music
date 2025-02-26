<script lang='ts'>
  import type { SongItem } from '$lib/types'
  import Button from '$lib/components/hana/Button.svelte'
  import Tooltip from '$lib/components/hana/Tooltip.svelte'
  import { addSongToPlaylist, addToPlaylistAndPlay } from '$lib/stores'
  import { handleDuration } from '$lib/utils'
  import { Ellipsis, PlayCircle, Plus } from 'lucide-svelte'

  interface Props {
    index: number
    song: SongItem
  }

  const { index, song }: Props = $props()
</script>

<div class='group/item w-full flex items-center justify-between rounded-lg bg-white px-4 py-2 even:bg-neutral-50 hover:bg-primary-100'>
  <div class='size-10 flex items-center justify-center group-hover/item:hidden'>{index}</div>
  <Tooltip class='hidden group-hover/item:block' content='播放'>
    <Button iconButton onclick={() => addToPlaylistAndPlay(song)}><PlayCircle /></Button>
  </Tooltip>
  <div class='flex flex-col space-y-1'>
    <span class='font-semibold'>{song.name}</span>
    <span class='text-sm text-neutral'>{song.alias.join(' / ')}</span>
  </div>
  <div>{song.artists.join(' / ')}</div>
  <div class='w-24 flex items-center justify-center group-hover/item:hidden'>{handleDuration(song.duration)}</div>
  <div class='w-24 justify-between hidden group-hover/item:flex'>
    <Tooltip content='添加到播放列表'>
      <Button iconButton onclick={() => addSongToPlaylist(song)}><Plus /></Button>
    </Tooltip>
    <Tooltip content='更多'>
      <Button iconButton><Ellipsis /></Button>
    </Tooltip>
  </div>
</div>

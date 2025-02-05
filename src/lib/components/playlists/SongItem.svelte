<script lang='ts'>
  import type { SongItem } from '$lib/types'
  import Button from '$lib/components/hana/Button.svelte'
  import Tooltip from '$lib/components/hana/Tooltip.svelte'
  import { handleDuration } from '$lib/utils'
  import { Ellipsis, PlayCircle, Plus } from 'lucide-svelte'

  interface Props {
    index: number
    song: SongItem
  }

  const { index, song }: Props = $props()
</script>

<div class='rounded-lg px-4 py-2 w-full flex justify-between items-center bg-white even:bg-neutral-50 hover:bg-primary-100 group/item'>
  <div class='size-10 flex justify-center items-center group-hover/item:hidden'>{index}</div>
  <Tooltip class='hidden group-hover/item:block' content='播放'>
    <Button iconButton><PlayCircle /></Button>
  </Tooltip>
  <div class='flex flex-col space-y-1'>
    <span class='font-semibold'>{song.name}</span>
    <span class='text-neutral text-sm'>{song.alias.join(' / ')}</span>
  </div>
  <div>{song.artists.join(' / ')}</div>
  <div class='w-24 flex justify-center items-center group-hover/item:hidden'>{handleDuration(song.duration)}</div>
  <div class='w-24 justify-between hidden group-hover/item:flex'>
    <Tooltip content='添加到播放列表'>
      <Button iconButton><Plus /></Button>
    </Tooltip>
    <Tooltip content='更多'>
      <Button iconButton><Ellipsis /></Button>
    </Tooltip>
  </div>
</div>

<script lang='ts'>
  import type { SongItem } from '$lib/types'
  import Button from '$lib/components/hana/Button.svelte'
  import Tooltip from '$lib/components/hana/Tooltip.svelte'
  import { handleDuration } from '$lib/utils'
  import { Play, Plus } from 'lucide-svelte'

  interface Props {
    song: SongItem
  }

  const { song }: Props = $props()
</script>

<tr class='text-center even:bg-neutral-50 hover:bg-primary-100 group'>
  <td class='rounded-l-lg'>
    <div class='relative inline-block rounded-lg cursor-pointer overflow-hidden'>
      <div class='absolute inset-0 size-full hidden justify-center items-center text-white bg-black/50 group-hover:flex'>
        <Play />
      </div>
      <img src={song.cover} alt={song.name} class='size-12 rounded-lg' />
    </div>
  </td>
  <td>{song.id}</td>
  <td>
    <p>{song.name}</p>
    <p class='text-neutral text-sm'>{song.alias.join(' / ')}</p>
  </td>
  <td>{song.artists.join(' / ')}</td>
  <td>{song.album}</td>
  <td>{handleDuration(song.duration)}</td>
  <td class='rounded-r-lg'>
    <Tooltip content='添加到播放列表' position='left' class='inline-block'>
      <Button ariaLabel='播放' iconButton variant='transparent' shape='circle'>
        <Plus />
      </Button>
    </Tooltip>
  </td>
</tr>

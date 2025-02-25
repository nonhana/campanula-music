<script lang='ts'>
  import type { SongItem } from '$lib/types'
  import Button from '$lib/components/hana/Button.svelte'
  import MaskElement from '$lib/components/hana/MaskElement.svelte'
  import Tooltip from '$lib/components/hana/Tooltip.svelte'
  import { handleDuration } from '$lib/utils'
  import { Play, Plus } from 'lucide-svelte'

  interface Props {
    song: SongItem
  }

  const { song }: Props = $props()
</script>

<tr class='group text-center even:bg-neutral-50 hover:bg-primary-100'>
  <td class='rounded-l-lg'>
    <MaskElement
      class='inline-block cursor-pointer overflow-hidden rounded-lg'
      maskClass='group-hover:flex'
    >
      {#snippet slot()}
        <Play />
      {/snippet}
      {#snippet root()}
        <img class='size-12' src={song.cover} alt={song.name} />
      {/snippet}
    </MaskElement>
  </td>
  <td>{song.id}</td>
  <td>
    <p>{song.name}</p>
    <p class='text-sm text-neutral'>{song.alias.join(' / ')}</p>
  </td>
  <td>{song.artists.join(' / ')}</td>
  <td>{song.album}</td>
  <td>{handleDuration(song.duration)}</td>
  <td class='rounded-r-lg'>
    <Tooltip content='添加到播放列表' position='left' class='inline-block'>
      <Button aria-label='播放' iconButton variant='transparent' shape='circle'>
        <Plus />
      </Button>
    </Tooltip>
  </td>
</tr>

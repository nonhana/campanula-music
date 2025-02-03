<script lang='ts'>
  import type { SongItem } from '$lib/types/song'
  import Button from '$lib/components/hana/Button.svelte'
  import { Plus } from 'lucide-svelte'

  interface Props {
    song: SongItem
  }

  const { song }: Props = $props()
</script>

<div class='px-2 w-80 h-20 flex items-center gap-4 border-b-2 last:border-b-0 border-neutral-200'>
  <div class='flex items-center gap-4'>
    <figure class='w-12 h-12 rounded-lg overflow-hidden cursor-pointer hover:bg-white'>
      <img class='w-full h-full object-cover aspect-square' src={song.cover} alt={`封面：${song.name}`} />
    </figure>

    <div class='flex flex-col gap-1'>
      <h2 class='font-medium cursor-pointer hover:text-primary'>{song.name}</h2>
      <p class='text-sm text-neutral'>{song.artist.join(' / ')}</p>
    </div>
  </div>

  <Button iconButton variant='transparent' ariaLabel='添加到播放列表' class='ml-auto'>
    <Plus />
  </Button>
</div>

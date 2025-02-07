<script lang='ts'>
  import type { SongItem } from '$lib/types/song'
  import Button from '$lib/components/hana/Button.svelte'
  import useMessage from '$lib/hooks/useMessage'
  import { Plus } from 'lucide-svelte'

  const { callHanaMessage } = useMessage()

  interface Props {
    song: SongItem
  }

  const { song }: Props = $props()

  const handleClick = () => {
    callHanaMessage({
      message: `已添加歌曲：${song.name}`,
      type: 'success',
    })
  }
</script>

<div class='px-2 w-80 h-20 flex items-center gap-4 border-b-2 last:border-b-0 border-neutral-200'>
  <div class='flex items-center gap-4'>
    <figure class='w-12 h-12 rounded-lg overflow-hidden cursor-pointer hover:bg-white'>
      <img class='w-full h-full object-cover aspect-square' src={song.cover} alt={`封面：${song.name}`} />
    </figure>

    <div class='flex flex-col gap-1'>
      <h2 class='font-medium cursor-pointer hover:text-primary'>{song.name}</h2>
      <p class='text-sm text-neutral'>{song.artists.join(' / ')}</p>
    </div>
  </div>

  <Button
    iconButton
    variant='transparent'
    aria-label='添加到播放列表'
    class='ml-auto'
    onclick={handleClick}
  >
    <Plus />
  </Button>
</div>

<script lang='ts'>
  import type { SongItem } from '$lib/types/song'
  import Button from '$lib/components/hana/Button.svelte'
  import LazyImage from '$lib/components/hana/LazyImage.svelte'
  import useMessage from '$lib/hooks/useMessage'
  import { addSongToPlaylist } from '$lib/stores'
  import { Plus } from 'lucide-svelte'

  const { callHanaMessage } = useMessage()

  interface Props {
    song: SongItem
  }

  const { song }: Props = $props()

  const onClick = async () => {
    try {
      await addSongToPlaylist(song)
      callHanaMessage({
        message: `已添加歌曲：${song.name}`,
        type: 'success',
      })
    }
    catch (error: any) {
      callHanaMessage({
        message: error.message,
        type: 'error',
      })
    }
  }
</script>

<div class='h-20 w-80 flex items-center gap-4 border-b-2 border-neutral-200 px-2 last:border-b-0'>
  <div class='flex items-center gap-4'>
    <figure class='h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-lg hover:bg-white'>
      <LazyImage class='aspect-square h-full w-full object-cover' src={song.album.cover} alt={`封面：${song.name}`} />
    </figure>

    <div class='flex flex-col gap-1'>
      <h2 class='line-clamp-1 cursor-pointer font-medium hover:text-primary'>{song.name}</h2>
      <p class='line-clamp-1 text-sm text-neutral'>{song.artists.map(artist => artist.name).join(' / ')}</p>
    </div>
  </div>

  <Button
    iconButton
    variant='transparent'
    aria-label='添加到播放列表'
    class='ml-auto'
    onclick={onClick}
  >
    <Plus />
  </Button>
</div>

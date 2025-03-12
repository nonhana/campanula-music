<script lang='ts'>
  import type { SongItem } from '$lib/types'
  import Button from '$lib/components/hana/Button.svelte'
  import LazyImage from '$lib/components/hana/LazyImage.svelte'
  import MaskElement from '$lib/components/hana/MaskElement.svelte'
  import Tooltip from '$lib/components/hana/Tooltip.svelte'
  import useMessage from '$lib/hooks/useMessage'
  import { addSongToPlaylist, addToPlaylistAndPlay } from '$lib/stores'
  import { durationFormatter } from '$lib/utils'
  import { Play, Plus } from 'lucide-svelte'

  const { callHanaMessage } = useMessage()

  interface Props {
    song: SongItem
  }

  const { song }: Props = $props()

  const handlePlay = async () => {
    try {
      await addToPlaylistAndPlay(song)
    }
    catch (error: any) {
      callHanaMessage({
        message: error.message,
        type: 'error',
      })
    }
  }

  const handleAddToPlaylist = async () => {
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

<tr class='group text-center even:bg-neutral-50 hover:bg-primary-100'>
  <td class='rounded-l-lg'>
    <MaskElement
      class='inline-block cursor-pointer overflow-hidden rounded-lg'
      maskClass='group-hover:flex'
      onclick={handlePlay}
    >
      {#snippet slot()}
        <Play />
      {/snippet}
      {#snippet root()}
        <LazyImage class='size-12' src={song.album.cover} alt={song.name} />
      {/snippet}
    </MaskElement>
  </td>
  <td>{song.id}</td>
  <td>
    <p>{song.name}</p>
    <p class='text-sm text-neutral'>{song.alias.join(' / ')}</p>
  </td>
  <td>{song.artists.map(artist => artist.name).join(' / ')}</td>
  <td>{song.album.name}</td>
  <td>{durationFormatter(song.duration)}</td>
  <td class='rounded-r-lg'>
    <Tooltip content='添加到播放列表' position='left' class='inline-block'>
      <Button
        aria-label='添加到播放列表'
        iconButton
        variant='transparent'
        shape='circle'
        onclick={handleAddToPlaylist}
      >
        <Plus />
      </Button>
    </Tooltip>
  </td>
</tr>

<script lang='ts'>
  import type { SongItem } from '$lib/types'
  import Button from '$lib/components/hana/Button.svelte'
  import LazyImage from '$lib/components/hana/LazyImage.svelte'
  import MaskElement from '$lib/components/hana/MaskElement.svelte'
  import Tooltip from '$lib/components/hana/Tooltip.svelte'
  import useMessage from '$lib/hooks/useMessage'
  import { addSongToPlaylist, addToPlaylistAndPlay, nowPlaying, paused, setPaused, songLoading } from '$lib/stores'
  import { durationFormatter } from '$lib/utils'
  import { Loader, Pause, Play, Plus } from 'lucide-svelte'

  const { callHanaMessage } = useMessage()

  interface Props {
    song: SongItem
  }

  const { song }: Props = $props()

  const activated = $derived($nowPlaying?.id === song.id)

  const handlePlay = async () => {
    if ($songLoading)
      return
    if (activated) {
      setPaused(!$paused)
      return
    }
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

  const handlePause = () => {
    setPaused(!$paused)
  }

  const handleMaskClick = () => {
    if (activated && !$paused)
      handlePause()
    else
      handlePlay()
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

<tr class='group text-center even:bg-neutral-50 hover:bg-primary-100!'>
  <td class='rounded-l-lg'>
    <div class='flex items-center justify-center py-2'>
      <MaskElement
        class='inline-block cursor-pointer overflow-hidden rounded-lg'
        maskClass={`group-hover:flex ${$songLoading ? 'cursor-not-allowed' : ''}`}
        onclick={handleMaskClick}
      >
        {#snippet slot()}
          {#if $songLoading}
            <Loader class='animate-spin' />
          {:else}
            {#if activated && !$paused}
              <Pause />
            {:else}
              <Play />
            {/if}
          {/if}
        {/snippet}
        {#snippet root()}
          <LazyImage class='size-12' src={song.cover} alt={song.name} />
        {/snippet}
      </MaskElement>
    </div>
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

<script lang='ts'>
  import type { SongItem } from '$lib/types/song'
  import Button from '$lib/components/hana/Button.svelte'
  import LazyImage from '$lib/components/hana/LazyImage.svelte'
  import MaskElement from '$lib/components/hana/MaskElement.svelte'
  import { useMessage } from '$lib/hooks/useMessage'
  import { addSongToPlaylist, addToPlaylistAndPlay, isSongInPlaylist, nowPlaying, paused, setNowPlaying, setPaused, songLoading } from '$lib/stores'
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
      if (isSongInPlaylist(song.id))
        await setNowPlaying(song)
      else
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

  const handleAddToPlaylist = () => {
    addSongToPlaylist(song)
    callHanaMessage({
      message: `已添加歌曲：${song.name}`,
      type: 'success',
    })
  }
</script>

<div class='group h-20 w-80 flex items-center gap-4 border-b-2 border-neutral-200 px-2 last:border-b-0'>
  <div class='flex items-center gap-4'>
    <MaskElement
      class='shrink-0 cursor-pointer overflow-hidden rounded-lg'
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
    <div class='flex flex-col gap-1'>
      <h2 class='line-clamp-1 font-medium'>{song.name}</h2>
      <p class='line-clamp-1 text-sm text-neutral'>{song.artists.map(artist => artist.name).join(' / ')}</p>
    </div>
  </div>

  <Button
    iconButton
    variant='transparent'
    aria-label='添加到播放列表'
    class='ml-auto'
    onclick={handleAddToPlaylist}
  >
    <Plus />
  </Button>
</div>

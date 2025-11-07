<script lang='ts'>
  import type { SongItem } from '$lib/types'
  import Button from '$lib/components/hana/Button.svelte'
  import { useMessage } from '$lib/hooks/useMessage'
  import { useTap } from '$lib/hooks/useTap.svelte'
  import {
    addSongToPlaylist,
    addToPlaylistAndPlay,
    isSongInPlaylist,
    nowPlaying,
    paused,
    setNowPlaying,
    setPaused,
    songLoading,
  } from '$lib/stores'
  import { durationFormatter } from '$lib/utils'
  import { Loader, Pause, Play, Plus } from 'lucide-svelte'

  interface Props {
    song: SongItem
  }

  const { song }: Props = $props()

  const { callHanaMessage } = useMessage()

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
        addToPlaylistAndPlay(song)
    }
    catch (error: any) {
      callHanaMessage({ message: error.message, type: 'error' })
    }
  }

  const handleAddToPlaylist = () => {
    addSongToPlaylist(song)
    callHanaMessage({ message: `已添加歌曲：${song.name}`, type: 'success' })
  }

  let nameEl = $state<HTMLDivElement | null>(null)
  useTap(() => nameEl, {
    onTap() {
      if (activated)
        return
      handlePlay()
    },
  })
</script>

<div
  role='button'
  tabindex='0'
  class='group/item h-18 w-full flex items-center rounded-lg bg-white px-4 hover:bg-primary-100'
>
  <div class='size-10 lg:size-12'>
    <img src={song.cover} alt={song.name} class='size-full rounded-lg object-cover' />
  </div>

  <div class='ml-4 flex flex-1 flex-col space-y-1' bind:this={nameEl}>
    <span class='line-clamp-1 font-semibold'>{song.name}</span>
    <span class='line-clamp-1 text-sm text-neutral'>{song.artists.map(a => a.name).join(' / ')}</span>
  </div>

  <div class='mx-2 w-24 text-right text-sm text-neutral hidden lg:block'>
    {durationFormatter(song.duration)}
  </div>

  <div class='w-22 flex items-center justify-end gap-2'>
    {#if $songLoading}
      <Button variant='transparent' iconButton disabled onclick={handlePlay}>
        <Loader class='animate-spin' />
      </Button>
    {:else}
      {#if activated && !$paused}
        <Button variant='transparent' iconButton onclick={() => setPaused(true)}><Pause /></Button>
      {:else}
        <Button variant='transparent' iconButton onclick={handlePlay}><Play /></Button>
      {/if}
    {/if}
    <Button variant='transparent' iconButton onclick={handleAddToPlaylist}><Plus /></Button>
  </div>
</div>

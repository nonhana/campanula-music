<script lang='ts'>
  import type { SongItem } from '$lib/types'
  import Button from '$lib/components/hana/Button.svelte'
  import Tooltip from '$lib/components/hana/Tooltip.svelte'
  import useMessage from '$lib/hooks/useMessage'
  import {
    addSongToPlaylist,
    addToPlaylistAndPlay,
    isSongInPlaylist,
    nowPlaying,
    paused,
    removeSongFromPlaylist,
    reset,
    setNowPlaying,
    setPaused,
    songLoading,
  } from '$lib/stores'
  import { durationFormatter } from '$lib/utils'
  import { Ellipsis, Loader, Pause, Play, Plus, X } from 'lucide-svelte'

  const { callHanaMessage } = useMessage()

  interface Props {
    index: number
    song: SongItem
    type?: 'list' | 'queue'
    showCover?: boolean
  }

  const { index, song, type = 'list', showCover = false }: Props = $props()

  const activated = $derived($nowPlaying?.id === song.id) // 这个 Item 是当前播放的歌曲

  const handlePlay = async () => {
    try {
      if (activated) {
        setPaused(!$paused)
        return
      }
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

  const typeClass = {
    list: 'bg-white even:bg-neutral-50 hover:bg-primary-100',
    queue: 'bg-white/0',
  }

  const activatedClass = {
    list: `bg-primary-100`,
    queue: `bg-white`,
  }

  const handleRemoveSong = () => {
    removeSongFromPlaylist(song.id)
    if (activated) {
      reset()
    }
  }
</script>

<div class={[
  'group/item shrink-0 w-full h-18 flex items-center justify-between rounded-lg px-4',
  typeClass[type],
  activated && activatedClass[type],
]}>
  <div class='flex items-center gap-10'>
    <div class='size-10 flex items-center justify-center group-hover/item:hidden'>{index}</div>
    <Tooltip class='hidden group-hover/item:block' content='播放' disabled={type === 'queue'}>
      {#if $songLoading}
        <Button disabled iconButton onclick={handlePlay} class={[activated && !$paused ? 'hidden' : 'block']}>
          <Loader class='animate-spin' />
        </Button>
      {:else}
        <Button iconButton onclick={handlePlay} class={[activated && !$paused ? 'hidden' : 'block']}><Play /></Button>
        <Button iconButton onclick={handlePause} class={[activated && !$paused ? 'block' : 'hidden']}><Pause /></Button>
      {/if}
    </Tooltip>
    {#if showCover}
      <div class='size-12'>
        <img src={song.cover} alt={song.name} class='size-full rounded-lg object-cover' />
      </div>
    {/if}
  </div>
  <div class='w-35 flex flex-col space-y-1'>
    <span class='line-clamp-1 font-semibold'>{song.name}</span>
    {#if song.alias.length > 0}
      <span class='line-clamp-1 text-sm text-neutral'>{song.alias.join(' / ')}</span>
    {/if}
  </div>
  <div class='line-clamp-2 w-30'>{song.artists.map(artist => artist.name).join(' / ')}</div>
  <div class='w-24 flex items-center justify-center group-hover/item:hidden'>{durationFormatter(song.duration)}</div>
  {#if type === 'list'}
    <div class='w-24 justify-between hidden group-hover/item:flex'>
      <Tooltip content='添加到播放列表'>
        <Button iconButton onclick={handleAddToPlaylist}><Plus /></Button>
      </Tooltip>
      <Tooltip content='更多'>
        <Button iconButton><Ellipsis /></Button>
      </Tooltip>
    </div>
  {:else}
    <div class='w-24 justify-center hidden group-hover/item:flex'>
      <Tooltip content='移除' disabled>
        <Button iconButton onclick={handleRemoveSong}><X /></Button>
      </Tooltip>
    </div>
  {/if}
</div>

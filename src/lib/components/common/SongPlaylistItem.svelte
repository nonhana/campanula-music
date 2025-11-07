<script lang='ts'>
  import type { SongItem } from '$lib/types'
  import Button from '$lib/components/hana/Button.svelte'
  import Tooltip from '$lib/components/hana/Tooltip.svelte'
  import { useMessage } from '$lib/hooks/useMessage'
  import { useTap } from '$lib/hooks/useTap.svelte'
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
    ondblclick?: () => void
  }

  const { index, song, type = 'list', showCover = false, ondblclick }: Props = $props()

  const activated = $derived($nowPlaying?.id === song.id) // 这个 Item 是当前播放的歌曲

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
      callHanaMessage({
        message: error.message,
        type: 'error',
      })
    }
  }

  const handlePause = () => {
    setPaused(!$paused)
  }

  const handleAddToPlaylist = () => {
    addSongToPlaylist(song)
    callHanaMessage({
      message: `已添加歌曲：${song.name}`,
      type: 'success',
    })
  }

  const typeClass = {
    list: 'bg-white hover:bg-primary-100!',
    queue: 'bg-white/0',
  }

  const activatedClass = {
    list: `bg-primary-100`,
    queue: `bg-white`,
  }

  const handleRemoveSong = () => {
    removeSongFromPlaylist(song.id)
    callHanaMessage({
      message: `已移除歌曲：${song.name}`,
      type: 'success',
    })
    if (activated) {
      reset()
    }
  }

  let songNameElement = $state<HTMLDivElement | null>(null)

  useTap(() => songNameElement, {
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
  class={[
    'group/item shrink-0 w-full h-18 flex items-center rounded-lg px-4',
    index % 2 === 0 && type === 'list' && 'bg-neutral-50!',
    typeClass[type],
    activated && activatedClass[type],
  ]}
  {ondblclick}
>
  <div class='flex items-center gap-10'>
    <div class='size-10 items-center justify-center hidden lg:flex group-hover/item:hidden'>{index}</div>
    <Tooltip class={['hidden', type === 'queue' ? 'md:group-hover/item:block' : 'group-hover/item:block']} content='播放' disabled={type === 'queue'}>
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
      <div class='size-10 lg:size-12 group-hover/item:hidden md:group-hover/item:block'>
        <img src={song.cover} alt={song.name} class='size-full rounded-lg object-cover' />
      </div>
    {/if}
  </div>
  <div bind:this={songNameElement} class={['ml-4 flex flex-1 flex-col space-y-1', type === 'list' && 'lg:ml-10']}>
    <span class='line-clamp-1 font-semibold'>{song.name}</span>
    {#if song.alias.length > 0}
      <div class='hidden lg:block'>
        <span class='line-clamp-1 text-sm text-neutral'>{song.alias.join(' / ')}</span>
      </div>
    {/if}
    <div class='lg:hidden'>
      <span class='line-clamp-1 text-sm text-neutral'>{song.artists.map(artist => artist.name).join(' / ')}</span>
    </div>
  </div>
  <div class='mx-2 flex-1 hidden lg:block'>
    <span class='line-clamp-1'>{song.artists.map(artist => artist.name).join(' / ')}</span>
  </div>
  <div class={['w-10 flex items-center justify-center group-hover/item:hidden', type === 'list' && 'lg:w-24']}>{durationFormatter(song.duration)}</div>
  {#if type === 'list'}
    <div class='w-10 justify-between hidden lg:w-24 group-hover/item:flex'>
      <Tooltip content='添加到播放列表'>
        <Button iconButton onclick={handleAddToPlaylist}><Plus /></Button>
      </Tooltip>
      <Tooltip class='hidden lg:block' content='更多'>
        <Button iconButton><Ellipsis /></Button>
      </Tooltip>
    </div>
  {:else}
    <div class='w-10 justify-center hidden group-hover/item:flex'>
      <Tooltip content='移除' disabled>
        <Button iconButton onclick={handleRemoveSong}><X /></Button>
      </Tooltip>
    </div>
  {/if}
</div>

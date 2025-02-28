<script lang='ts'>
  import type { SongItem } from '$lib/types'
  import Button from '$lib/components/hana/Button.svelte'
  import Tooltip from '$lib/components/hana/Tooltip.svelte'
  import useMessage from '$lib/hooks/useMessage'
  import { addSongToPlaylist, addToPlaylistAndPlay, nowPlaying, paused, setPaused } from '$lib/stores'
  import { handleDuration } from '$lib/utils'
  import { Ellipsis, Pause, Play, Plus, X } from 'lucide-svelte'

  const { callHanaMessage } = useMessage()

  interface Props {
    index: number
    song: SongItem
    type?: 'list' | 'queue'
  }

  const { index, song, type = 'list' }: Props = $props()

  const activated = $derived($nowPlaying?.id === song.id)

  const handlePlay = async () => {
    try {
      if (activated) {
        setPaused(!$paused)
        return
      }
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
</script>

<div class={[
  'group/item shrink-0 w-full h-16 flex items-center justify-between rounded-lg px-4',
  typeClass[type],
  activated && activatedClass[type],
]}>
  <div class='size-10 flex items-center justify-center group-hover/item:hidden'>{index}</div>
  <Tooltip class='hidden group-hover/item:block' content='播放' disabled={type === 'queue'}>
    <Button iconButton onclick={handlePlay} class={[activated && !$paused ? 'hidden' : 'block']}><Play /></Button>
    <Button iconButton onclick={handlePause} class={[activated && !$paused ? 'block' : 'hidden']}><Pause /></Button>
  </Tooltip>
  <div class='flex flex-col space-y-1'>
    <span class='font-semibold'>{song.name}</span>
    <span class='text-sm text-neutral'>{song.alias.join(' / ')}</span>
  </div>
  <div>{song.artists.join(' / ')}</div>
  <div class='w-24 flex items-center justify-center group-hover/item:hidden'>{handleDuration(song.duration)}</div>
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
        <Button iconButton><X /></Button>
      </Tooltip>
    </div>
  {/if}
</div>

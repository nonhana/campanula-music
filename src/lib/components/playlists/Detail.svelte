<script lang='ts'>
  import type { PlaylistItem, SongItem } from '$lib/types'
  import { page } from '$app/state'
  import Button from '$lib/components/hana/Button.svelte'
  import Dropdown from '$lib/components/hana/Dropdown.svelte'
  import DropdownItem from '$lib/components/hana/DropdownItem.svelte'
  import DropdownMenu from '$lib/components/hana/DropdownMenu.svelte'
  import Input from '$lib/components/hana/Input.svelte'
  import LazyImage from '$lib/components/hana/LazyImage.svelte'
  import { useMessage } from '$lib/hooks/useMessage'
  import { setNowPlaying, setSongLoading, songLoading, updatePlaylist } from '$lib/stores'
  import { Ellipsis, Loader, Play, Plus, Search, X } from 'lucide-svelte'
  import { onMount } from 'svelte'

  const { callHanaMessage } = useMessage()

  interface Props {
    playlist: PlaylistItem
    songs: SongItem[]
    searchValue: string
  }

  let { playlist, songs, searchValue = $bindable('') }: Props = $props()

  const moreMap = [{
    text: '添加到播放列表',
    command: 'add-to-playlist',
  }]

  const handleAddPlaylistSongs = (autoplay: boolean = false) => {
    try {
      setSongLoading(true)
      updatePlaylist(songs)
      callHanaMessage({
        message: '播放列表已更新',
        type: 'success',
      })
      if (autoplay) {
        setNowPlaying(songs[0])
      }
    }
    catch (error: any) {
      callHanaMessage({
        message: error.message,
        type: 'error',
      })
    }
    finally {
      !autoplay && setSongLoading(false)
    }
  }

  onMount(() => {
    if (page.url.searchParams.get('autoplay') === 'true') {
      handleAddPlaylistSongs(true)
    }
  })

  const handleCommand = (command: string | number | object) => {
    switch (command) {
      case 'add-to-playlist':
        handleAddPlaylistSongs()
        break
      default:
        break
    }
  }
</script>

<div class='flex gap-4 lg:gap-8'>
  <LazyImage
    src={playlist.cover ?? ''}
    alt={`歌单 ${playlist.name} 的封面`}
    class='aspect-square size-32 shrink-0 rounded-2xl lg:size-48'
  />
  <div class='w-full flex flex-col justify-between'>
    <h2 class='font-semibold lg:text-2xl'>{playlist.name}</h2>
    <p class='text-neutral'>{playlist.musicCount} 首歌曲</p>
    <p class='line-clamp-2 break-words text-wrap text-xs text-neutral scrollbar-none lg:line-clamp-none lg:max-h-[76px] lg:overflow-y-scroll lg:text-sm'>{playlist.description ?? '暂无描述'}</p>
    <div class='w-full items-center hidden lg:flex space-x-5'>
      <Button variant='accent' onclick={() => handleAddPlaylistSongs(true)} disabled={$songLoading}>
        <span class='flex items-center gap-2'>
          {#if $songLoading}
            <Loader size={16} class='animate-spin' />
          {:else}
            <Play size={16} />
          {/if} 播放全部
        </span>
      </Button>
      <Dropdown position='bottom' trigger='click' oncommand={handleCommand}>
        <Button iconButton variant='transparent'>
          <Ellipsis />
        </Button>
        {#snippet dropdown()}
          <DropdownMenu>
            {#each moreMap as { text, command }}
              <DropdownItem {command}>
                {text}
              </DropdownItem>
            {/each}
          </DropdownMenu>
        {/snippet}
      </Dropdown>
      <Input
        type='text'
        shape='rounded'
        size='sm'
        placeholder='搜索此歌单中的歌曲…'
        bind:value={searchValue}
      >
        {#snippet prefixIcon()}
          <Search size={16} />
        {/snippet}
        {#snippet suffixIcon()}
          {#if searchValue}
            <button
              type='button'
              class='rounded-md p-1 hover:bg-neutral-100'
              aria-label='清空搜索'
              onclick={() => (searchValue = '')}
            >
              <X class='size-4' />
            </button>
          {/if}
        {/snippet}
      </Input>
    </div>
  </div>
</div>

<div class='w-full flex justify-between space-x-5 lg:hidden'>
  <Button class='flex-1' variant='accent' onclick={() => handleAddPlaylistSongs(true)} disabled={$songLoading}>
    <span class='mx-auto inline-block w-fit flex items-center gap-2 text-sm'>
      {#if $songLoading}
        <Loader size={16} class='animate-spin' />
      {:else}
        <Play size={16} />
      {/if} 播放全部
    </span>
  </Button>
  <Button class='flex-1' variant='secondary' onclick={() => handleAddPlaylistSongs()}>
    <span class='mx-auto inline-block w-fit flex items-center gap-2 text-sm'>
      <Plus /> 播放列表
    </span>
  </Button>
</div>

<!-- 移动端搜索栏 -->
<div class='lg:hidden'>
  <Input
    type='text'
    shape='rounded'
    size='md'
    placeholder='搜索此歌单中的歌曲…'
    bind:value={searchValue}
  >
    {#snippet prefixIcon()}
      <Search size={16} />
    {/snippet}
    {#snippet suffixIcon()}
      {#if searchValue}
        <button
          type='button'
          class='rounded-md p-1 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary'
          aria-label='清空搜索'
          onclick={() => (searchValue = '')}
        >
          <X class='size-4' />
        </button>
      {/if}
    {/snippet}
  </Input>
</div>

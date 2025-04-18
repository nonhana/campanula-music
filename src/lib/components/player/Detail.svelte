<script lang='ts'>
  import Button from '$lib/components/hana/Button.svelte'
  import Dropdown from '$lib/components/hana/Dropdown.svelte'
  import DropdownMenu from '$lib/components/hana/DropdownMenu.svelte'
  import LazyImage from '$lib/components/hana/LazyImage.svelte'
  import { useTap } from '$lib/hooks/useTap.svelte'
  import {
    currentTime,
    muted,
    nowPlaying,
    paused,
    playMode,
    setPaused,
    setPlayMode,
    setSeeking,
    songLoading,
    toggleShowDetail,
    volume,
  } from '$lib/stores'
  import { durationFormatter, secondsToMs } from '$lib/utils'
  import {
    ArrowLeftRight,
    Loader,
    Music,
    Pause,
    Play,
    Repeat,
    Repeat1,
    Shuffle,
    SkipBack,
    SkipForward,
    Volume,
    Volume1,
    Volume2,
    VolumeX,
  } from 'lucide-svelte'

  interface Props {
    currentProgress: number
    handleInput: (e: Event) => void
    handleChange: (e: Event) => void
    handleChangeSong: (type: 'prev' | 'next') => () => void
  }

  const {
    currentProgress,
    handleInput,
    handleChange,
    handleChangeSong,
  }: Props = $props()

  const changePlayMode = () => {
    switch ($playMode) {
      case 'shuffle':
        setPlayMode('repeatAll')
        break
      case 'repeatAll':
        setPlayMode('repeatOne')
        break
      case 'repeatOne':
        setPlayMode('sequential')
        break
      case 'sequential':
        setPlayMode('shuffle')
        break
    }
  }

  let wrapperElement = $state<HTMLElement | null>(null)

  useTap(() => wrapperElement, {
    onTap() {
      toggleShowDetail()
    },
  })
</script>

<div class='size-full flex flex-col justify-between'>
  <div bind:this={wrapperElement}>
    {#if $nowPlaying}
      <LazyImage
        src={$nowPlaying.album.cover}
        alt={$nowPlaying.name}
        class='w-full rounded-2xl object-cover md:w-[27rem]'
      />
    {:else}
      <div class='aspect-square w-full flex items-center justify-center rounded-2xl bg-white/60 text-neutral md:w-[27rem]'>
        <Music size={128} />
      </div>
    {/if}
  </div>
  <div class='flex flex-col gap-2'>
    <span class='text-xl font-semibold'>{$nowPlaying?.name ?? '未在播放'}</span>
    {#if $nowPlaying?.alias}
      <span class='text-neutral font-semibold'>{$nowPlaying.alias.join(' / ')}</span>
    {/if}
    {#if $nowPlaying}
      <span class='text-sm text-neutral'>{$nowPlaying.artists.map(artist => artist.name).join(' / ')}</span>
    {/if}
  </div>
  <input
    type='range'
    disabled={!$nowPlaying}
    min='0'
    max='1'
    step='0.001'
    value={currentProgress}
    oninput={handleInput}
    onchange={handleChange}
    onpointerdown={() => setSeeking(true)}
    class='w-full'
  />
  <div class='flex select-none justify-between text-sm text-neutral'>
    <span>{durationFormatter(secondsToMs($currentTime))}</span>
    <span>{$nowPlaying ? durationFormatter($nowPlaying.duration) : '--:--'}</span>
  </div>
  <div class='w-full flex items-center justify-between text-neutral'>
    <Dropdown trigger='click' clickClose={false}>
      <Button iconButton variant='transparent'>
        {#if $muted}
          <VolumeX />
        {:else if $volume === 0}
          <Volume />
        {:else if $volume < 0.5}
          <Volume1 />
        {:else if $volume <= 1}
          <Volume2 />
        {:else}
          <Volume />
        {/if}
      </Button>
      {#snippet dropdown()}
        <DropdownMenu>
          <div class='h-6 flex items-center justify-center'>
            <input
              type='range'
              min='0'
              max='1'
              step='0.01'
              bind:value={$volume}
              disabled={$muted}
              class='w-28'
            />
          </div>
        </DropdownMenu>
      {/snippet}
    </Dropdown>

    <div class='flex items-center gap-10'>
      <SkipBack class='cursor-pointer' onclick={handleChangeSong('prev')} />
      {#if $songLoading}
        <Loader size='32' class='animate-spin text-neutral-600' />
      {:else}
        <Play size='32' class={`cursor-pointer ${$paused ? 'block' : 'hidden'}`} onclick={() => setPaused(false)} />
        <Pause size='32' class={`cursor-pointer ${$paused ? 'hidden' : 'block'}`} onclick={() => setPaused(true)} />
      {/if}
      <SkipForward class='cursor-pointer' onclick={handleChangeSong('next')} />
    </div>

    <Button iconButton variant='transparent' onclick={changePlayMode}>
      <Shuffle class={`cursor-pointer ${$playMode === 'shuffle' ? 'block' : 'hidden'}`} />
      <Repeat class={`cursor-pointer ${$playMode === 'repeatAll' ? 'block' : 'hidden'}`} />
      <Repeat1 class={`cursor-pointer ${$playMode === 'repeatOne' ? 'block' : 'hidden'}`} />
      <ArrowLeftRight class={`cursor-pointer ${$playMode === 'sequential' ? 'block' : 'hidden'}`} />
    </Button>
  </div>
</div>

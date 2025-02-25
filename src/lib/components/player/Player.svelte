<script lang='ts'>
  import MaskElement from '$lib/components/hana/MaskElement.svelte'
  import useMessage from '$lib/hooks/useMessage'
  import {
    currentTime,
    mute,
    muted,
    nowPlaying,
    paused,
    playMode,
    seeking,
    setCurrentTime,
    setPaused,
    setPlayMode,
    setSeeking,
    volume,
  } from '$lib/stores'
  import { handleDuration } from '$lib/utils'
  import {
    ArrowLeftRight,
    ChevronUp,
    Menu,
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
  import { onMount } from 'svelte'
  import PlayerDrawer from './PlayerDrawer.svelte'

  const { callHanaMessage } = useMessage()

  let sliderProgress = $state(0)
  const currentProgress = $derived(
    $nowPlaying
      ? ($seeking ? sliderProgress : ($currentTime / $nowPlaying.duration))
      : 0,
  )

  // audio 元素对象
  let audioElement = $state<HTMLAudioElement | null>(null)

  const handlePointerDown = () => {
    setSeeking(true)
  }

  const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement
    sliderProgress = target.valueAsNumber
  }

  const handleChange = (e: Event) => {
    const target = e.target as HTMLInputElement
    sliderProgress = target.valueAsNumber
    if ($nowPlaying) {
      const newTime = Math.floor(sliderProgress * $nowPlaying.duration)
      setCurrentTime(newTime)
      if (audioElement) {
        audioElement.currentTime = newTime
      }
    }
    setSeeking(false)
  }

  const globalPause = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault()
      setPaused(!$paused)
    }
  }

  onMount(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', globalPause)
    }
    return () => {
      window.removeEventListener('keydown', globalPause)
    }
  })

  let showDrawer = $state(false)
  const toggleShowDrawer = () => {
    showDrawer = !showDrawer
  }

  $effect(() => {
    if (!$paused && !$nowPlaying) {
      callHanaMessage({
        message: '请先选择一首歌曲',
        type: 'warning',
      })
      setPaused(true)
    }
  })

  const curTimeInfo = $derived(
    $nowPlaying
      ? `${handleDuration(Math.floor($currentTime))} / ${handleDuration($nowPlaying.duration)}`
      : '--:-- / --:--',
  )
</script>

<footer class='fixed bottom-0 w-full h-20 z-20 bg-neutral-200/40 backdrop-blur flex items-center px-5'>
  {#if $nowPlaying}
    <audio
      preload='metadata'
      autoplay
      src={$nowPlaying.source}
      bind:this={audioElement}
      bind:currentTime={$currentTime}
      bind:paused={$paused}
      bind:volume={$volume}
      bind:muted={$muted}
      class='hidden'
    ></audio>
  {/if}
  <input
    type='range'
    disabled={!$nowPlaying}
    min='0'
    max='1'
    step='0.001'
    value={currentProgress}
    oninput={handleInput}
    onchange={handleChange}
    onpointerdown={handlePointerDown}
    class='w-full absolute -translate-y-1/2 top-0 left-0'
  />
  <div class='flex items-center gap-10'>
    <SkipBack class='cursor-pointer' />
    <Play size='32' class={`cursor-pointer ${$paused ? 'block' : 'hidden'}`} onclick={() => setPaused(false)} />
    <Pause size='32' class={`cursor-pointer ${$paused ? 'hidden' : 'block'}`} onclick={() => setPaused(true)} />
    <SkipForward class='cursor-pointer' />
  </div>
  <span class='ml-5 text-sm text-neutral select-none'>
    {curTimeInfo}
  </span>
  <div class='absolute left-1/2 -translate-x-1/2 flex items-center gap-5'>
    <MaskElement
      class='rounded-lg overflow-hidden group'
      maskClass='group-hover:flex'
      onclick={toggleShowDrawer}
    >
      {#snippet slot()}
        <ChevronUp />
      {/snippet}
      {#snippet root()}
        {#if $nowPlaying}
          <img class='size-12' src={$nowPlaying.cover} alt={$nowPlaying.name} />
        {:else}
          <div class='size-12 flex justify-center items-center rounded-lg bg-white text-neutral'>
            <Music size={24} />
          </div>
        {/if}
      {/snippet}
    </MaskElement>

    <div class='flex flex-col'>
      <span>{$nowPlaying ? $nowPlaying.name : '暂无歌曲'}</span>
      {#if $nowPlaying}
        <span class='text-sm text-neutral'>{$nowPlaying.artists.join(' / ')}</span>
      {/if}
    </div>
  </div>

  <div class='flex items-center gap-5 ml-auto'>
    <Shuffle class={`cursor-pointer ${$playMode === 'shuffle' ? 'block' : 'hidden'}`} onclick={() => setPlayMode('repeat')} />
    <Repeat class={`cursor-pointer ${$playMode === 'repeat' ? 'block' : 'hidden'}`} onclick={() => setPlayMode('repeat1')} />
    <Repeat1 class={`cursor-pointer ${$playMode === 'repeat1' ? 'block' : 'hidden'}`} onclick={() => setPlayMode('list')} />
    <ArrowLeftRight class={`cursor-pointer ${$playMode === 'list' ? 'block' : 'hidden'}`} onclick={() => setPlayMode('repeat')} />
    <div class='relative cursor-pointer flex flex-col items-center gap-5 group'>
      <div class='absolute w-28 px-4 py-2 bg-neutral-200 justify-center -rotate-90 -translate-y-[calc(50%+3.5rem)] hidden group-hover:flex rounded-full'>
        <input
          type='range'
          min='0'
          max='1'
          step='0.01'
          bind:value={$volume}
          disabled={$muted}
          class='w-full'
        />
      </div>
      <button onclick={mute}>
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
      </button>
    </div>
    <Menu class='cursor-pointer' />
  </div>
</footer>

<PlayerDrawer
  bind:showDrawer={showDrawer}
  {currentProgress}
  {handleInput}
  {handleChange}
  {handlePointerDown}
/>

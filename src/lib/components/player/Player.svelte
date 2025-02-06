<script lang='ts'>
  import Button from '$lib/components/hana/Button.svelte'
  import MaskImg from '$lib/components/hana/MaskImg.svelte'
  import { nowPlaying, repeat, repeating, shuffle, shuffling } from '$lib/stores'
  import { handleDuration } from '$lib/utils'
  import {
    ChevronUp,
    Pause,
    Play,
    RotateCwSquare,
    Shuffle,
    SkipBack,
    SkipForward,
    Volume,
    Volume1,
    Volume2,
    VolumeX,
  } from 'lucide-svelte'

  let currentTime = $state(0)
  const currentProgress = $derived($nowPlaying ? (currentTime / $nowPlaying.duration) : 0)
  const handleProgress = (e: Event) => {
    const target = e.target as HTMLInputElement
    currentTime = Math.floor(target.valueAsNumber * $nowPlaying!.duration)
  }

  let paused = $state(false)
  const togglePaused = () => {
    paused = !paused
  }

  let volume = $state(0.5)
  let closeVolume = $state(false)
</script>

<footer class='fixed bottom-0 w-full h-20 z-20 bg-neutral-200 flex items-center px-5'>
  {#if $nowPlaying}
    <audio
      src={$nowPlaying.source}
      autoplay
      bind:currentTime
      bind:volume
      bind:paused
      onvolumechange={() => closeVolume = volume === 0}
      class='hidden'
    ></audio>
  {/if}
  {#if $nowPlaying}
    <input
      type='range'
      min='0'
      max='1'
      step='0.01'
      value={currentProgress}
      defaultValue={currentProgress}
      onchange={handleProgress}
      class='w-full absolute -translate-y-1/2 top-0 left-0'
    />
  {/if}
  <div class='flex items-center gap-10'>
    <SkipBack class='cursor-pointer' />
    <Play size='32' class={`cursor-pointer ${paused ? 'block' : 'hidden'}`} onclick={togglePaused} />
    <Pause size='32' class={`cursor-pointer ${paused ? 'hidden' : 'block'}`} onclick={togglePaused} />
    <SkipForward class='cursor-pointer' />
  </div>
  {#if $nowPlaying}
    <span class='ml-5 text-sm text-neutral select-none'>
      {handleDuration(Math.floor(currentTime))} / {handleDuration($nowPlaying.duration)}
    </span>
  {/if}
  {#if $nowPlaying}
    <div class='absolute left-1/2 -translate-x-1/2 flex items-center gap-5'>
      <MaskImg
        src={$nowPlaying.cover}
        alt={$nowPlaying.name}
        class='rounded-lg cursor-pointer overflow-hidden group'
        maskClass='group-hover:flex'
        imgClass='size-12'
      >
        {#snippet slot()}
          <ChevronUp />
        {/snippet}
      </MaskImg>
      <div class='flex flex-col'>
        <span>{$nowPlaying.name}</span>
        <span class='text-sm text-neutral'>{$nowPlaying.artists.join(' / ')}</span>
      </div>
    </div>
  {/if}

  <div class='flex items-center gap-5 ml-auto'>
    <Button iconButton shape='circle' activated={$shuffling} onclick={shuffle}>
      <Shuffle />
    </Button>
    <Button iconButton shape='circle' activated={$repeating} onclick={repeat}>
      <RotateCwSquare />
    </Button>
    <div class='relative cursor-pointer flex flex-col items-center gap-5 group'>
      <div class='absolute w-28 px-4 py-2 bg-neutral-200 justify-center -rotate-90 -translate-y-[calc(50%+3.5rem)] hidden group-hover:flex rounded-full'>
        <input
          type='range'
          min='0'
          max='1'
          step='0.01'
          bind:value={volume}
          class='w-full'
        />
      </div>
      {#if closeVolume}
        <VolumeX />
      {:else if volume === 0}
        <Volume />
      {:else if volume < 0.5}
        <Volume1 />
      {:else if volume <= 1}
        <Volume2 />
      {:else}
        <Volume />
      {/if}
    </div>
  </div>
</footer>

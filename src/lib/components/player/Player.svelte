<script lang='ts'>
  import MaskElement from '$lib/components/hana/MaskElement.svelte'
  import useMessage from '$lib/hooks/useMessage'
  import {
    currentTime,
    mute,
    muted,
    nowPlaying,
    nowPlayingUrl,
    paused,
    playlist,
    playMode,
    seeking,
    setCurrentTime,
    setNowPlaying,
    setPaused,
    setPlayMode,
    setSeeking,
    setSongLoading,
    songLoading,
    volume,
  } from '$lib/stores'
  import { durationFormatter, msToSeconds, secondsToMs } from '$lib/utils'
  import {
    ArrowLeftRight,
    ChevronUp,
    Loader,
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
      ? ($seeking ? sliderProgress : (secondsToMs($currentTime) / $nowPlaying.duration))
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
      const newTime = msToSeconds(Math.floor(sliderProgress * $nowPlaying.duration))
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

  // 处理音频加载错误
  const handleAudioError = () => {
    const songName = $nowPlaying ? $nowPlaying.name : '当前歌曲'
    callHanaMessage({
      message: `${songName}加载失败，请检查音频文件是否可用`,
      type: 'error',
    })
    setPaused(true)
    setSongLoading(false)
  }

  const handleLoadStart = () => {
    setSongLoading(true)
  }

  const handleCanPlay = () => {
    setSongLoading(false)
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
      ? `${durationFormatter(secondsToMs($currentTime))} / ${durationFormatter($nowPlaying.duration)}`
      : '--:-- / --:--',
  )

  const handleChangeSong = (type: 'prev' | 'next') => {
    return () => {
      if (!$nowPlaying)
        return
      const curSongIndex = $playlist.findIndex(item => item.id === $nowPlaying.id)
      if (type === 'prev') {
        const prevSong = $playlist[curSongIndex - 1]
        if (prevSong)
          setNowPlaying(prevSong)
      }
      else {
        const nextSong = $playlist[curSongIndex + 1]
        if (nextSong)
          setNowPlaying(nextSong)
      }
    }
  }
</script>

<footer class='fixed bottom-0 z-20 h-20 w-full flex items-center bg-neutral-200/40 px-5 backdrop-blur'>
  {#if $nowPlaying}
    <audio
      preload='metadata'
      autoplay
      src={$nowPlayingUrl}
      bind:this={audioElement}
      bind:currentTime={$currentTime}
      bind:paused={$paused}
      bind:volume={$volume}
      bind:muted={$muted}
      onerror={handleAudioError}
      onloadstart={handleLoadStart}
      oncanplay={handleCanPlay}
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
    class='absolute left-0 top-0 z-10 w-full -translate-y-1/2'
    style='--progress: {currentProgress}'
  />
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
  <span class='ml-5 select-none text-sm text-neutral'>
    {curTimeInfo}
  </span>
  <div class='absolute left-1/2 flex items-center gap-5 -translate-x-1/2'>
    <MaskElement
      class='group overflow-hidden rounded-lg'
      maskClass='group-hover:flex'
      onclick={toggleShowDrawer}
    >
      {#snippet slot()}
        <ChevronUp />
      {/snippet}
      {#snippet root()}
        {#if $nowPlaying}
          <div class='relative'>
            <img class='size-12' src={$nowPlaying.cover} alt={$nowPlaying.name} />
            {#if $songLoading}
              <div class='absolute inset-0 flex items-center justify-center rounded-lg bg-black/30'>
                <Loader size={16} class='animate-spin text-white' />
              </div>
            {/if}
          </div>
        {:else}
          <div class='size-12 flex items-center justify-center rounded-lg bg-white text-neutral'>
            <Music size={24} />
          </div>
        {/if}
      {/snippet}
    </MaskElement>

    <div class='flex flex-col'>
      <div class='flex items-center gap-2'>
        <span>{$nowPlaying ? $nowPlaying.name : '暂无歌曲'}</span>
        {#if $songLoading && $nowPlaying}
          <Loader size={14} class='animate-spin text-neutral-500' />
        {/if}
      </div>
      {#if $nowPlaying}
        <span class='text-sm text-neutral'>{$nowPlaying.artists.map(artist => artist.name).join(' / ')}</span>
      {/if}
    </div>
  </div>

  <div class='ml-auto flex items-center gap-5'>
    <Shuffle class={`cursor-pointer ${$playMode === 'shuffle' ? 'block' : 'hidden'}`} onclick={() => setPlayMode('repeat')} />
    <Repeat class={`cursor-pointer ${$playMode === 'repeat' ? 'block' : 'hidden'}`} onclick={() => setPlayMode('repeat1')} />
    <Repeat1 class={`cursor-pointer ${$playMode === 'repeat1' ? 'block' : 'hidden'}`} onclick={() => setPlayMode('list')} />
    <ArrowLeftRight class={`cursor-pointer ${$playMode === 'list' ? 'block' : 'hidden'}`} onclick={() => setPlayMode('repeat')} />
    <div class='group relative flex flex-col cursor-pointer items-center gap-5'>
      <div class='absolute z-10 h-10 w-32 items-center rounded-lg bg-white px-4 hidden group-hover:flex -translate-y-[calc(50%+4rem)] -rotate-90'>
        <input
          type='range'
          min='0'
          max='1'
          step='0.01'
          bind:value={$volume}
          disabled={$muted}
          class='w-full'
          style='--progress: {$volume}'
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
  {handleChangeSong}
/>

<style lang='scss'>
  /* 自定义全局range输入样式 */
  :global(input[type="range"]) {
    appearance: none;
    height: 4px;
    border-radius: 8px;
    background: rgba(165, 165, 165, 0.3);
    cursor: pointer;
    transition: all 0.2s ease;

    &::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: theme('colors.primary.400');
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 0 0 4px rgba(0, 0, 0, 0);
    }

    &::-moz-range-thumb {
      width: 12px;
      height: 12px;
      border: none;
      border-radius: 50%;
      background: theme('colors.primary.400');
      cursor: pointer;
      transition: all 0.2s ease;
    }

    &:hover {
      background: rgba(165, 165, 165, 0.5);

      &::-webkit-slider-thumb {
        background: theme('colors.primary.500');
        transform: scale(1.2);
      }

      &::-moz-range-thumb {
        background: theme('colors.primary.500');
        transform: scale(1.2);
      }
    }

    &:active {
      &::-webkit-slider-thumb {
        background: theme('colors.primary.600');
        transform: scale(1.4);
        box-shadow: 0 0 0 4px rgba(168, 230, 207, 0.3);
      }

      &::-moz-range-thumb {
        background: theme('colors.primary.600');
        transform: scale(1.4);
        box-shadow: 0 0 0 4px rgba(168, 230, 207, 0.3);
      }
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;

      &::-webkit-slider-thumb {
        background: #ccc;
        cursor: not-allowed;
      }

      &::-moz-range-thumb {
        background: #ccc;
        cursor: not-allowed;
      }
    }
  }

  /* 单独定制进度条样式 */
  footer input[type="range"] {
    height: 4px;
    background: linear-gradient(to right,
      theme('colors.primary.400') calc(var(--progress) * 100%),
      rgba(165, 165, 165, 0.3) calc(var(--progress) * 100%)
    );
    margin: 0;

    &::-webkit-slider-runnable-track {
      background: transparent;
    }

    &::-moz-range-track {
      background: transparent;
    }
  }
</style>

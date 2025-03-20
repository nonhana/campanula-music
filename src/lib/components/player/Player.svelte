<script lang='ts'>
  import type { SongItem } from '$lib/types'
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

  // audio 元素对象（单例模式）
  let audioElement = $state<HTMLAudioElement | null>(null)

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

  $effect(() => {
    callHanaMessage({
      message: `当前播放模式：${$playMode}`,
      type: 'info',
    })
  })

  /**
   * 根据当前播放模式和方向获取下一首要播放的歌曲
   * @param direction 方向：'prev'上一首，'next'下一首，'auto'根据播放模式自动决定
   * @returns 下一首歌曲或undefined（如果没有下一首）
   */
  const getNextSong = (direction: 'prev' | 'next' | 'auto') => {
    if (!$nowPlaying || $playlist.length === 0)
      return undefined

    const curSongIndex = $playlist.findIndex(item => item.id === $nowPlaying.id)
    if (curSongIndex === -1)
      return undefined

    // 在顺序播放模式且已经是最后一首歌，不自动播放下一首
    if (direction === 'auto' && $playMode === 'sequential' && curSongIndex === $playlist.length - 1) {
      return undefined
    }

    let availableSongs: SongItem[] = []

    switch ($playMode) {
      case 'repeatOne': // 单曲循环
        // 手动点击时切换歌曲，自动播放结束时重复当前歌曲
        if (direction === 'auto') {
          return $nowPlaying // 返回当前歌曲表示重复播放
        }
        // 对于手动点击的情况，按照普通列表循环模式处理
        return direction === 'prev'
          ? $playlist[(curSongIndex - 1 + $playlist.length) % $playlist.length]
          : $playlist[(curSongIndex + 1) % $playlist.length]

      case 'shuffle': // 随机播放
        // 从剩余歌曲中随机选择一首，避免连续播放同一首
        availableSongs = [...$playlist].filter(song => song.id !== $nowPlaying.id)
        if (availableSongs.length === 0)
          return $playlist[0]
        return availableSongs[Math.floor(Math.random() * availableSongs.length)]

      case 'repeatAll': // 列表循环
        return direction === 'prev'
          ? $playlist[(curSongIndex - 1 + $playlist.length) % $playlist.length]
          : $playlist[(curSongIndex + 1) % $playlist.length]

      case 'sequential': // 顺序播放
      default:
        if (direction === 'prev') {
          return curSongIndex > 0 ? $playlist[curSongIndex - 1] : undefined
        }
        else {
          return curSongIndex < $playlist.length - 1 ? $playlist[curSongIndex + 1] : undefined
        }
    }
  }

  // 主动切歌（上、下一首）
  const handleChangeSong = (direction: 'prev' | 'next') => {
    return () => {
      const nextSong = getNextSong(direction)
      if (nextSong) {
        setNowPlaying(nextSong)
      }
      else if (direction === 'next' && $playMode === 'sequential') {
        setPaused(true)
        if (audioElement) {
          audioElement.currentTime = 0
        }
      }
    }
  }

  // 当前曲目播放结束
  const handleAudioEnded = () => {
    const nextSong = getNextSong('auto')

    if (nextSong) {
      // 检查是否是当前歌曲（单曲循环时）
      if (nextSong.id === $nowPlaying?.id) {
        if (audioElement) {
          audioElement.currentTime = 0
          audioElement.play()
        }
      }
      else {
        setNowPlaying(nextSong)
      }
    }
    else {
      // 没有下一首歌曲了（列表播放模式且已到末尾）
      setPaused(true)
      if (audioElement) {
        audioElement.currentTime = 0
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
      onloadstart={() => setSongLoading(true)}
      oncanplay={() => setSongLoading(false)}
      onended={handleAudioEnded}
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
    onpointerdown={() => setSeeking(true)}
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
    <Shuffle class={`cursor-pointer ${$playMode === 'shuffle' ? 'block' : 'hidden'}`} onclick={() => setPlayMode('repeatAll')} />
    <Repeat class={`cursor-pointer ${$playMode === 'repeatAll' ? 'block' : 'hidden'}`} onclick={() => setPlayMode('repeatOne')} />
    <Repeat1 class={`cursor-pointer ${$playMode === 'repeatOne' ? 'block' : 'hidden'}`} onclick={() => setPlayMode('sequential')} />
    <ArrowLeftRight class={`cursor-pointer ${$playMode === 'sequential' ? 'block' : 'hidden'}`} onclick={() => setPlayMode('shuffle')} />
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
  {handleChangeSong}
/>

<style lang='scss'>
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

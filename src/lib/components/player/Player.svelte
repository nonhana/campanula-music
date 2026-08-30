<script lang='ts'>
  import type { SongItem } from '$lib/types'
  import LikeButton from '$lib/components/common/LikeButton.svelte'
  import Button from '$lib/components/hana/Button.svelte'
  import MaskElement from '$lib/components/hana/MaskElement.svelte'
  import { useMessage } from '$lib/hooks/useMessage'
  import { ncmImageSrc } from '$lib/ncm/image'
  import {
    currentTime,
    mute,
    muted,
    nowPlaying,
    nowPlayingUrl,
    paused,
    PLAY_MODE_MAP,
    playlist,
    playMode,
    registerMediaSessionHandlers,
    seeking,
    setCurrentTime,
    setNowPlaying,
    setPaused,
    setPlayMode,
    setSeeking,
    setSelectedMenu,
    setSongLoading,
    songLoading,
    updateMediaSessionPlaybackState,
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
  } from '@lucide/svelte'
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
    // 输入法组合期与文本框内的按键不触发全局暂停，避免搜索框输入空格被吞或误切歌
    if (e.isComposing)
      return
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]'))
      return
    if (e.code === 'Space') {
      e.preventDefault()
      setPaused(!$paused)
    }
  }

  // 处理音频加载错误
  const handleAudioError = () => {
    // 无播放地址（无版权/资源不可用）时原因已由编排层如实提示，这里不重复报「加载失败」
    if (!$nowPlayingUrl) {
      setSongLoading(false)
      return
    }
    const songName = $nowPlaying ? $nowPlaying.name : '当前歌曲'
    callHanaMessage({
      message: `${songName}加载失败，请检查音频文件是否可用`,
      type: 'error',
    })
    setPaused(true)
    setSongLoading(false)
  }

  /**
   * 根据当前播放模式和方向获取下一首要播放的歌曲
   * @param direction 'prev'上一首，'next'下一首，'auto'根据播放模式自动决定
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

  onMount(() => {
    window.addEventListener('keydown', globalPause)

    // 注册 Media Session 事件处理器
    registerMediaSessionHandlers({
      onPlay: () => setPaused(false),
      onPause: () => setPaused(true),
      onPreviousTrack: () => handleChangeSong('prev')(),
      onNextTrack: () => handleChangeSong('next')(),
    })

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
      message: `当前播放模式：${PLAY_MODE_MAP[$playMode]}`,
      type: 'info',
    })
  })

  // 监听播放状态变化，同步更新 Media Session
  $effect(() => {
    updateMediaSessionPlaybackState($paused)
  })

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

<footer class='fixed bottom-16 z-20 h-20 w-full flex flex-row-reverse items-center bg-app-surface-hover/40 px-5 backdrop-blur md:bottom-0 md:flex-row md:pl-[17.5rem]'>
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
    aria-label='播放进度'
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
  <div class='flex shrink-0 items-center gap-5 md:gap-10'>
    <Button iconButton variant='transparent' aria-label='上一首' onclick={handleChangeSong('prev')}>
      <SkipBack />
    </Button>
    {#if $songLoading}
      <Loader size='32' class='animate-spin text-neutral-600' />
    {:else}
      <Button iconButton variant='transparent' aria-label='播放' class={$paused ? 'flex' : 'hidden'} onclick={() => setPaused(false)}>
        <Play size='32' />
      </Button>
      <Button iconButton variant='transparent' aria-label='暂停' class={$paused ? 'hidden' : 'flex'} onclick={() => setPaused(true)}>
        <Pause size='32' />
      </Button>
    {/if}
    <Button iconButton variant='transparent' aria-label='下一首' onclick={handleChangeSong('next')}>
      <SkipForward />
    </Button>
  </div>
  <span class='ml-5 select-none text-sm text-neutral hidden md:inline'>
    {curTimeInfo}
  </span>

  <div class='relative min-w-0 flex flex-1 items-center gap-5 md:mx-auto md:max-w-[26rem] md:justify-center'>
    <MaskElement
      class='group shrink-0 overflow-hidden rounded-lg'
      onclick={toggleShowDrawer}
    >
      {#snippet slot()}
        <ChevronUp />
      {/snippet}
      {#snippet root()}
        {#if $nowPlaying?.cover}
          <div class='relative'>
            <img class='size-12' src={ncmImageSrc($nowPlaying.cover, 'xs')} alt={$nowPlaying.name} />
            {#if $songLoading}
              <div class='absolute inset-0 flex items-center justify-center rounded-lg bg-app-mask/50'>
                <Loader class='animate-spin text-white' />
              </div>
            {/if}
          </div>
        {:else}
          <!-- 空封面（搜索结果 cover 可空）与无歌曲共用占位图标，避免 alt 文字叠标题 -->
          <div class='size-12 flex items-center justify-center rounded-lg bg-app-surface text-neutral'>
            <Music size={24} />
          </div>
        {/if}
      {/snippet}
    </MaskElement>

    <div class='min-w-0 flex flex-col'>
      <span class='line-clamp-1'>{$nowPlaying ? $nowPlaying.name : '暂无歌曲'}</span>
      {#if $nowPlaying}
        <span class='line-clamp-1 text-sm text-neutral'>{$nowPlaying.artists.map(artist => artist.name).join(' / ')}</span>
      {/if}
    </div>
    {#if $nowPlaying}
      <LikeButton song={$nowPlaying} />
    {/if}
  </div>

  <div class='ml-auto shrink-0 items-center gap-5 hidden md:flex'>
    <Button iconButton variant='transparent' aria-label='切换为循环播放' class={$playMode === 'shuffle' ? 'flex' : 'hidden'} onclick={() => setPlayMode('repeatAll')}>
      <Shuffle />
    </Button>
    <Button iconButton variant='transparent' aria-label='切换为单曲循环' class={$playMode === 'repeatAll' ? 'flex' : 'hidden'} onclick={() => setPlayMode('repeatOne')}>
      <Repeat />
    </Button>
    <Button iconButton variant='transparent' aria-label='切换为顺序播放' class={$playMode === 'repeatOne' ? 'flex' : 'hidden'} onclick={() => setPlayMode('sequential')}>
      <Repeat1 />
    </Button>
    <Button iconButton variant='transparent' aria-label='切换为随机播放' class={$playMode === 'sequential' ? 'flex' : 'hidden'} onclick={() => setPlayMode('shuffle')}>
      <ArrowLeftRight />
    </Button>
    <div class='group relative flex flex-col cursor-pointer items-center gap-5'>
      <div class='absolute z-10 h-10 w-32 items-center rounded-lg bg-app-surface px-4 hidden group-focus-within:flex group-hover:flex -translate-y-[calc(50%+4rem)] -rotate-90'>
        <input
          type='range'
          min='0'
          max='1'
          step='0.01'
          bind:value={$volume}
          disabled={$muted}
          aria-label='音量'
          class='w-full'
          style='--progress: {$volume}'
        />
      </div>
      <button aria-label='静音' onclick={mute}>
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
    <Button iconButton variant='transparent' aria-label='打开播放列表' onclick={() => {
      toggleShowDrawer()
      setSelectedMenu('playlist')
    }}>
      <Menu />
    </Button>
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
    background: rgb(var(--skin-neutral-300) / 0.3);
    cursor: pointer;
    transition: all 0.2s ease;

    &::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: rgb(var(--skin-primary-400));
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 0 0 4px rgba(0, 0, 0, 0);
    }

    &::-moz-range-thumb {
      width: 12px;
      height: 12px;
      border: none;
      border-radius: 50%;
      background: rgb(var(--skin-primary-400));
      cursor: pointer;
      transition: all 0.2s ease;
    }

    &:hover {
      background: rgb(var(--skin-neutral-300) / 0.5);

      &::-webkit-slider-thumb {
        background: rgb(var(--skin-primary-500));
        transform: scale(1.2);
      }

      &::-moz-range-thumb {
        background: rgb(var(--skin-primary-500));
        transform: scale(1.2);
      }
    }

    &:active {
      &::-webkit-slider-thumb {
        background: rgb(var(--skin-primary-600));
        transform: scale(1.4);
        box-shadow: 0 0 0 4px rgb(var(--skin-primary) / 0.3);
      }

      &::-moz-range-thumb {
        background: rgb(var(--skin-primary-600));
        transform: scale(1.4);
        box-shadow: 0 0 0 4px rgb(var(--skin-primary) / 0.3);
      }
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;

      &::-webkit-slider-thumb {
        background: rgb(var(--skin-neutral-300));
        cursor: not-allowed;
      }

      &::-moz-range-thumb {
        background: rgb(var(--skin-neutral-300));
        cursor: not-allowed;
      }
    }
  }

  footer input[type="range"] {
    height: 4px;
    background: linear-gradient(to right,
      rgb(var(--skin-primary-400)) calc(var(--progress) * 100%),
      rgb(var(--skin-neutral-300) / 0.3) calc(var(--progress) * 100%)
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

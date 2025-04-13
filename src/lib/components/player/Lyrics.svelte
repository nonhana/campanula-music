<script lang='ts'>
  import type { LyricItem as LyricItemType } from '$lib/types'
  import Button from '$lib/components/hana/Button.svelte'
  import VirtualList from '$lib/components/hana/VirtualList.svelte'
  import { useTap } from '$lib/hooks/useTap.svelte'
  import {
    currentTime,
    nowPlaying,
    paused,
    setCurrentTime,
    toggleShowDetail,
  } from '$lib/stores'
  import { durationFormatter, msToSeconds, secondsToMs } from '$lib/utils'
  import { ChevronLeft } from 'lucide-svelte'
  import { fade } from 'svelte/transition'
  import LyricItem from './LyricItem.svelte'

  const CONTAINER_SIZE = 640
  const ITEM_SIZE = 80
  const ACTIVATED_INDEX = 3
  const TAIL_EMPTY_ITEMS = Math.floor(CONTAINER_SIZE / ITEM_SIZE) - ACTIVATED_INDEX - 1

  let currentLyricIndex = $state(0) // 当前歌词索引
  let scrollContainerElement = $state<HTMLDivElement | null>(null)

  let activatedLyric = $state<LyricItemType | null>(null)

  const moveToTargetLyric = () => {
    if (!$nowPlaying || !activatedLyric)
      return

    setCurrentTime(msToSeconds(activatedLyric.time))
  }

  let scrollPos = $state(0)
  const scrollStatus = $state({
    customScrolling: false,
    restoring: false,
  })
  let scrollTimer: ReturnType<typeof setTimeout> | null = null

  // currentTime 变化，找到当前歌词
  $effect(() => {
    if (!$nowPlaying)
      return

    // 找出当前歌词
    const targetLyricsIndex = $nowPlaying.lyrics.findIndex((item, index) => {
      const nextTime = $nowPlaying.lyrics[index + 1]?.time
      return secondsToMs($currentTime) >= item.time && secondsToMs($currentTime) < (nextTime || Infinity)
    })

    if (targetLyricsIndex !== -1 && targetLyricsIndex !== currentLyricIndex) {
      currentLyricIndex = targetLyricsIndex
    }
  })

  // currentLyricIndex 变化，找到当前歌词的位置
  const targetOffset = $derived(currentLyricIndex * ITEM_SIZE)
  // 是否正在自动滚动歌词
  const isAutoScrolling = $derived($nowPlaying?.lyrics.findIndex(item => item.time === activatedLyric?.time) === currentLyricIndex - 1)

  // targetOffset 变化，触发自动滚动
  $effect(() => {
    if (!$nowPlaying || !scrollContainerElement)
      return

    // 如果歌曲正在播放，并且此时用户正在滚动歌词，不触发自动滚动
    if (!$paused && scrollStatus.customScrolling)
      return

    scrollContainerElement.scrollTo({
      top: targetOffset,
      behavior: 'smooth',
    })
  })

  // 回到原来位置
  const moveToOriginal = () => {
    if (scrollStatus.restoring)
      return
    scrollStatus.customScrolling = false
    scrollStatus.restoring = true

    if (!scrollContainerElement)
      return

    scrollContainerElement.scrollTo({
      top: targetOffset,
      behavior: 'smooth',
    })

    scrollTimer = setTimeout(() => {
      scrollStatus.restoring = false
    }, 1000)
  }

  // 滚动时的触发函数
  const onscroll = (e: Event) => {
    if (scrollTimer) {
      clearTimeout(scrollTimer)
      scrollTimer = null
    }

    const target = e.target as HTMLElement
    scrollPos = target.scrollTop

    if (!scrollStatus.restoring && !isAutoScrolling && !scrollStatus.customScrolling) {
      scrollStatus.customScrolling = true
    }
  }

  // 滚动结束后的触发函数
  const onscrollend = () => {
    if (scrollStatus.restoring) {
      scrollStatus.restoring = false
      return
    }

    scrollTimer = setTimeout(moveToOriginal, 1000)
  }

  const actionDisabled = $derived(!scrollStatus.customScrolling || isAutoScrolling || scrollStatus.restoring)

  useTap(() => scrollContainerElement, {
    onTap() {
      toggleShowDetail()
    },
  })
</script>

{#if $nowPlaying}
  <div class='relative size-full flex md:gap-5'>
    <div
      bind:this={scrollContainerElement}
      class='relative w-full overflow-auto scrollbar-none'
      {onscroll}
      {onscrollend}
    >
      <VirtualList
        items={$nowPlaying.lyrics}
        containerSize={CONTAINER_SIZE}
        itemSize={ITEM_SIZE}
        headEmptyItems={ACTIVATED_INDEX}
        tailEmptyItems={TAIL_EMPTY_ITEMS}
        {scrollPos}
      >
        {#snippet renderItem(item, index)}
          <LyricItem
            lyric={item}
            isActivated={index === ACTIVATED_INDEX}
            activateCallback={lyric => activatedLyric = lyric}
          />
        {/snippet}
      </VirtualList>
    </div>
    <div
      class='relative'
      style={`top: ${ITEM_SIZE * (ACTIVATED_INDEX + 0.5) - 16}px`}
    >
      <Button variant='transparent' disabled={actionDisabled} onclick={moveToTargetLyric}>
        <div class='flex items-center -mx-2'>
          <ChevronLeft class='text-neutral' />
          {#if !actionDisabled}
            <span
              in:fade={{ duration: 200 }}
              out:fade={{ duration: 200 }}
              class='inline-block'
            >
              {durationFormatter(activatedLyric?.time ?? 0)}
            </span>
          {/if}
        </div>
      </Button>
    </div>
  </div>
{:else}
  <div bind:this={scrollContainerElement} class='size-full flex items-center justify-center text-neutral' style:height={`${CONTAINER_SIZE}px`}>
    <span>当前未播放音乐</span>
  </div>
{/if}

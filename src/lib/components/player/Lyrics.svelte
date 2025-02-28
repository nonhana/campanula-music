<script lang='ts'>
  import type { LyricItem as LyricItemType } from '$lib/types'
  import Button from '$lib/components/hana/Button.svelte'
  import VirtualList from '$lib/components/hana/VirtualList.svelte'
  import {
    currentTime,
    nowPlaying,
    paused,
    setCurrentTime,
  } from '$lib/stores'
  import { numCorrector } from '$lib/utils'
  import { ChevronLeft } from 'lucide-svelte'
  import LyricItem from './LyricItem.svelte'

  const CONTAINER_SIZE = 640
  const ITEM_SIZE = 80
  const ACTIVATED_INDEX = 3

  let currentLyricIndex = $state(0) // 当前歌词索引
  let scrollContainerElement = $state<HTMLDivElement | null>(null)

  let activatedLyric = $state<LyricItemType | null>(null)

  const moveToTargetLyric = () => {
    if (!$nowPlaying || !activatedLyric)
      return

    setCurrentTime(activatedLyric.time)
  }

  let scrollPos = $state(0)
  const scrollStatus = $state({
    autoScrolling: false,
    customScrolling: false,
    restoring: false,
  })
  let scrollTimer: NodeJS.Timeout | null = null

  // currentTime 变化，找到当前歌词
  $effect(() => {
    if (!$nowPlaying)
      return

    const targetLyricsIndex = $nowPlaying.lyrics.findIndex((item, index) => {
      const nextTime = $nowPlaying.lyrics[index + 1]?.time
      return $currentTime >= item.time && $currentTime < (nextTime || Infinity)
    })

    if (targetLyricsIndex !== -1 && targetLyricsIndex !== currentLyricIndex) {
      currentLyricIndex = targetLyricsIndex
    }
  })

  // currentLyricIndex 变化，找到当前歌词的位置
  const targetOffset = $derived(currentLyricIndex * ITEM_SIZE)

  // targetOffset 变化，触发自动滚动
  $effect(() => {
    if (!$nowPlaying || !scrollContainerElement)
      return

    scrollStatus.autoScrolling = true

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

  // 吸附到最近的歌词
  const snapToNearest = (e: Event) => {
    if (!scrollContainerElement)
      return

    const target = e.target as HTMLElement
    const targetScrollTop = numCorrector(target.scrollTop, ITEM_SIZE)

    scrollContainerElement.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth',
    })
  }

  // 滚动时的触发函数
  const onScroll = (e: Event) => {
    if (scrollTimer) {
      clearTimeout(scrollTimer)
      scrollTimer = null
    }

    const target = e.target as HTMLElement
    scrollPos = target.scrollTop

    if (!scrollStatus.restoring && !scrollStatus.customScrolling && !scrollStatus.autoScrolling) {
      scrollStatus.customScrolling = true
    }
  }

  // 滚动结束后的触发函数
  const onScrollend = (e: Event) => {
    snapToNearest(e)

    if (scrollStatus.autoScrolling) {
      scrollStatus.autoScrolling = false
      return
    }

    if (scrollStatus.restoring) {
      scrollStatus.restoring = false
      return
    }

    scrollTimer = setTimeout(moveToOriginal, 1000)
  }

  const actionDisabled = $derived(scrollStatus.customScrolling && !scrollStatus.restoring && !scrollStatus.autoScrolling)
</script>

{#if $nowPlaying}
  {#if $nowPlaying.lyrics.length !== 0}
    <div class='relative size-full flex gap-5'>
      <div
        bind:this={scrollContainerElement}
        class='relative overflow-auto scrollbar-none'
        onscroll={onScroll}
        onscrollend={onScrollend}
      >
        <VirtualList
          items={$nowPlaying.lyrics}
          containerSize={CONTAINER_SIZE}
          itemSize={ITEM_SIZE}
          emptyItems={ACTIVATED_INDEX}
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
        <Button iconButton variant='transparent' disabled={!actionDisabled} onclick={moveToTargetLyric}>
          <ChevronLeft class='text-neutral' />
        </Button>
      </div>
      {#if actionDisabled}
        <div class='absolute left-1/2 top-0 -translate-x-1/2'>
          <Button onclick={moveToOriginal}>返回原位</Button>
        </div>
      {/if}
    </div>
  {:else}
    <div class='size-full flex items-center justify-center text-neutral-400' style:height={`${CONTAINER_SIZE}px`}>
      <span>纯音乐，请欣赏</span>
    </div>
  {/if}
{:else}
  <div class='size-full flex items-center justify-center text-neutral-400' style:height={`${CONTAINER_SIZE}px`}>
    <span>当前未播放音乐</span>
  </div>
{/if}

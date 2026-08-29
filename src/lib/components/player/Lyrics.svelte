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
  // 无歌词/未加载时的占位条目（空数组与未定义都落到同一占位，如实呈现）
  const NO_LYRIC_PLACEHOLDER = { time: 0, text: '暂无歌词', translate: null }
  // 行首元信息白名单（作词/作曲等 credits 行）：仅匹配行首标签+冒号，避免误伤真实歌词行
  const LYRIC_META_PATTERN = /^\s*(?:作词|作詞|作曲|编曲|編曲|填词|填詞|监制|監製|制作人|製作人|混音|母带|母帶|录音|錄音|配唱|和声|和聲)\s*[:：]/

  const allLyrics = $derived($nowPlaying?.lyrics ?? [])
  const metaLyrics = $derived(allLyrics.filter(item => LYRIC_META_PATTERN.test(item.text)))
  const singingLyrics = $derived(allLyrics.filter(item => !LYRIC_META_PATTERN.test(item.text)))

  let currentLyricIndex = $state(0) // 当前歌词索引
  let scrollContainerElement = $state<HTMLDivElement | null>(null)

  let activatedLyric = $state<LyricItemType | null>(null)
  let isAutoScrolling = $state(false) // 是否正在自动滚动歌词

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
    if (singingLyrics.length === 0)
      return

    // 找出当前歌词（过滤后数组内的索引）
    const targetLyricsIndex = singingLyrics.findIndex((item, index) => {
      const nextTime = singingLyrics[index + 1]?.time
      return secondsToMs($currentTime) >= item.time && secondsToMs($currentTime) < (nextTime || Number.POSITIVE_INFINITY)
    })

    if (targetLyricsIndex !== -1 && targetLyricsIndex !== currentLyricIndex) {
      currentLyricIndex = targetLyricsIndex
    }
  })

  // currentLyricIndex 变化，找到当前歌词的位置
  // targetOffset 基于过滤后的歌词数组（元信息行已拆出，索引与 VirtualList 对齐）
  const targetOffset = $derived(currentLyricIndex * ITEM_SIZE)

  // targetOffset 变化，触发自动滚动
  $effect(() => {
    if (!$nowPlaying || !scrollContainerElement)
      return

    // 如果歌曲正在播放，并且此时用户正在滚动歌词，不触发自动滚动
    if (!$paused && scrollStatus.customScrolling)
      return

    isAutoScrolling = true
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
    // 编程触发的平滑滚动结束
    if (isAutoScrolling) {
      isAutoScrolling = false
      return
    }

    // 恢复滚动中的一次性结束
    if (scrollStatus.restoring) {
      scrollStatus.restoring = false
      return
    }

    // 仅当用户滚动过时，才在停止后一段时间恢复到目标位置
    if (scrollStatus.customScrolling) {
      scrollTimer = setTimeout(moveToOriginal, 1000)
    }
  }

  const actionDisabled = $derived(!scrollStatus.customScrolling || isAutoScrolling || scrollStatus.restoring)

  let wrapperElement = $state<HTMLElement | null>(null)

  useTap(() => wrapperElement, {
    onTap() {
      toggleShowDetail()
    },
  })
</script>

<div bind:this={wrapperElement} class='relative size-full flex md:gap-5'>
  {#if $nowPlaying}
    <div class='min-w-0 flex flex-1 flex-col gap-3'>
      {#if metaLyrics.length > 0}
        <!-- 作词/作曲等元信息：静态块，不参与滚动与时间对齐 -->
        <div class='text-sm text-neutral space-y-1'>
          {#each metaLyrics as meta (meta.time)}
            <span class='block'>{meta.text}</span>
          {/each}
        </div>
      {/if}
      <div
        bind:this={scrollContainerElement}
        class='relative w-full overflow-auto scrollbar-none'
        {onscroll}
        {onscrollend}
      >
        <VirtualList
          items={singingLyrics.length ? singingLyrics : [NO_LYRIC_PLACEHOLDER]}
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
  {:else}
    <div class='flex items-center justify-center text-neutral' style:height={`${CONTAINER_SIZE}px`}>
      <span>当前未播放音乐</span>
    </div>
  {/if}
</div>

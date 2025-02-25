<script lang='ts'>
  import type { LyricItem as LyricItemType } from '$lib/types'
  import Button from '$lib/components/hana/Button.svelte'
  import VirtualList from '$lib/components/hana/VirtualList.svelte'
  import {
    currentLyricIndex,
    nowLyrics,
    nowPlaying,
    setCurrentLyricIndex,
  } from '$lib/stores'
  import { ChevronLeft } from 'lucide-svelte'
  import LyricItem from './LyricItem.svelte'

  const CONTAINER_SIZE = 640
  const ITEM_SIZE = 80
  const EMPTY_ITEMS = 3

  interface Props {
    currentTime: number
  }

  let { currentTime = $bindable() }: Props = $props()

  let scrollContainerElement = $state<HTMLDivElement | null>(null)

  let activatedLyric = $state<LyricItemType | null>(null)

  const moveToTargetLyric = () => {
    if (!$nowPlaying || !$nowLyrics || !activatedLyric)
      return

    currentTime = activatedLyric.time
  }

  const targetOffset = $derived($currentLyricIndex * ITEM_SIZE)

  let scrollPos = $state(0)
  const scrollStatus = $state({
    autoScrolling: false,
    customScrolling: false,
    restoring: false,
  })
  let scrollTimer: NodeJS.Timeout | null = null

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
  const onScrollend = () => {
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

  $effect(() => {
    if (!$nowPlaying || !$nowLyrics || !scrollContainerElement)
      return

    scrollStatus.autoScrolling = true

    scrollContainerElement.scrollTo({
      top: targetOffset,
      behavior: 'smooth',
    })
  })

  $effect(() => {
    if (!$nowPlaying || !$nowLyrics)
      return

    const targetLyricsIndex = $nowLyrics.lyrics.findIndex((item, index) => {
      const nextTime = $nowLyrics.lyrics[index + 1]?.time
      return currentTime >= item.time && currentTime < (nextTime || Infinity)
    })

    if (targetLyricsIndex !== -1 && targetLyricsIndex !== $currentLyricIndex) {
      setCurrentLyricIndex(targetLyricsIndex)
    }
  })

  const actionDisabled = $derived(scrollStatus.customScrolling && !scrollStatus.restoring && !scrollStatus.autoScrolling)
</script>

{#if $nowLyrics}
  {#if $nowLyrics.lyrics.length !== 0}
    <div class='relative flex gap-5'>
      <div
        bind:this={scrollContainerElement}
        class='relative overflow-auto scrollbar-hidden'
        style={`height: ${CONTAINER_SIZE}px`}
        onscroll={onScroll}
        onscrollend={onScrollend}
      >
        <VirtualList
          items={$nowLyrics.lyrics}
          containerSize={CONTAINER_SIZE}
          itemSize={ITEM_SIZE}
          emptyItems={EMPTY_ITEMS}
          {scrollPos}
        >
          {#snippet renderItem(item, index)}
            <LyricItem
              lyric={item}
              isActivated={index === EMPTY_ITEMS}
              activateCallback={lyric => activatedLyric = lyric}
            />
          {/snippet}
        </VirtualList>
      </div>
      <div
        class='relative'
        style={`top: ${ITEM_SIZE * (EMPTY_ITEMS + 0.5) - 16}px`}
      >
        <Button iconButton variant='transparent' disabled={!actionDisabled} onclick={moveToTargetLyric}>
          <ChevronLeft class='text-neutral' />
        </Button>
      </div>
      {#if actionDisabled}
        <div class='absolute top-0 left-1/2 -translate-x-1/2'>
          <Button onclick={moveToOriginal}>返回原位</Button>
        </div>
      {/if}
    </div>
  {:else}
    <div class='flex items-center justify-center h-80 text-neutral-400'>
      <span>纯音乐，请欣赏</span>
    </div>
  {/if}
{:else}
  <div class='flex items-center justify-center h-80 text-neutral-400'>
    <span>当前未播放音乐</span>
  </div>
{/if}

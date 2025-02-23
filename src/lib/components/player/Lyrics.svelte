<script lang='ts'>
  import VirtualList from '$lib/components/hana/VirtualList.svelte'
  import {
    currentLyricIndex,
    nowLyrics,
    nowPlaying,
    seeking,
    setCurrentLyricIndex,
  } from '$lib/stores'
  import { handleDuration } from '$lib/utils'
  import { ChevronLeft } from 'lucide-svelte'

  const CONTAINER_SIZE = 640
  const ITEM_SIZE = 80
  const EMPTY_ITEMS = 3

  interface Props {
    currentProgress: number
  }

  let { currentProgress = $bindable() }: Props = $props()

  let scrollContainerElement = $state<HTMLDivElement | null>(null)

  let scrollPos = $state(0)

  const onScroll = (e: Event) => {
    const target = e.target as HTMLElement
    scrollPos = target.scrollTop
  }

  let curTime = $state(0)

  $effect(() => {
    if (!$nowPlaying || $seeking)
      return

    curTime = Math.floor(currentProgress * $nowPlaying.duration)
  })

  $effect(() => {
    if (!$nowPlaying || !$nowLyrics)
      return

    const targetLyricsIndex = $nowLyrics.lyrics.findIndex((item, index) => {
      const nextTime = $nowLyrics.lyrics[index + 1]?.time
      return curTime >= item.time && curTime < (nextTime || Infinity)
    })

    if (targetLyricsIndex !== -1 && targetLyricsIndex !== $currentLyricIndex) {
      setCurrentLyricIndex(targetLyricsIndex)
    }
  })

  $effect(() => {
    if (!$nowPlaying || !$nowLyrics || !scrollContainerElement)
      return

    const targetOffset = $currentLyricIndex * ITEM_SIZE

    scrollContainerElement.scrollTo({
      top: targetOffset,
      behavior: 'smooth',
    })
  })
</script>

{#if $nowLyrics}
  {#if $nowLyrics.lyrics.length !== 0}
    <div class='relative'>
      <div
        bind:this={scrollContainerElement}
        class='relative overflow-auto scrollbar-hidden'
        style={`height: ${CONTAINER_SIZE}px`}
        onscroll={onScroll}
      >
        <VirtualList
          items={$nowLyrics.lyrics}
          containerSize={CONTAINER_SIZE}
          itemSize={ITEM_SIZE}
          emptyItems={EMPTY_ITEMS}
          {scrollPos}
        >
          {#snippet renderItem(item)}
            <div class='flex items-center gap-10 w-80 h-20'>
              <span>{item.time}</span>
              <div class='flex flex-col gap-2'>
                <span>{item.text}</span>
                {#if item.translate}
                  <span>{item.translate}</span>
                {/if}
              </div>
              <span>{handleDuration(item.time)}</span>
            </div>
          {/snippet}
        </VirtualList>
      </div>
      <div
        class='absolute w-full px-2 flex items-center'
        style={`top: ${ITEM_SIZE * (EMPTY_ITEMS + 0.5)}px;transform: translateY(-50%);`}
      >
        <div class='w-full h-[1px] bg-neutral-400'></div>
        <ChevronLeft size='32' class='text-neutral' />
      </div>
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

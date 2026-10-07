<!--
  PROTOTYPE · 播放队列：标题、播放来源、清空；虚拟列表（可能有 4,815 首），当前歌曲高亮。
  打开时滚到当前歌曲附近。
-->
<script lang='ts'>
  import type { Song } from '$lib/prototype/data'
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine, formatCount, formatDuration } from '$lib/prototype/data'
  import { player } from '$lib/prototype/player.svelte'
  import VirtualList from '$lib/prototype/VirtualList.svelte'
  import { X } from '@lucide/svelte'
  import { untrack } from 'svelte'
  import Bars from './Bars.svelte'

  interface Props {
    /** 桌面抽屉的关闭按钮；手机由弹层把手收起 */
    onclose?: () => void
  }

  const { onclose }: Props = $props()

  const ROW = 56
  let scroller = $state<HTMLElement>()

  $effect(() => {
    if (scroller)
      scroller.scrollTop = Math.max(0, (untrack(() => player.index) - 2) * ROW)
  })

  function keyOf(song: Song, i: number) {
    return `${i}-${song.id}`
  }
</script>

<section class='queue' aria-label='播放队列'>
  <header class='head'>
    <div class='head-text'>
      <h2>播放队列</h2>
      <p>来自「{player.source.name}」 · <span class='tnum'>{formatCount(player.queue.length)}</span> 首</p>
    </div>
    <button type='button' class='clear' onclick={() => player.clear()} disabled={player.queue.length <= 1}>清空</button>
    {#if onclose}
      <button type='button' class='close' aria-label='关闭播放队列' onclick={onclose}>
        <X size={18} strokeWidth={2} />
      </button>
    {/if}
  </header>
  <div class='scroller' bind:this={scroller}>
    {#if scroller}
      <VirtualList items={player.queue} itemHeight={ROW} scrollParent={scroller} getKey={keyOf}>
        {#snippet row(song, i)}
          {@const isCurrent = i === player.index}
          <div class={['item', isCurrent && 'current', song.unavailable && 'off']}>
            <button
              type='button'
              class='hit'
              disabled={song.unavailable}
              aria-label={isCurrent ? `${song.title}，正在播放` : `播放 ${song.title}`}
              aria-current={isCurrent ? 'true' : undefined}
              onclick={() => player.playFrom(player.queue, i, player.source)}
            ></button>
            <span class='lead tnum'>
              {#if isCurrent}<Bars playing={player.playing} size={13} />{:else}{i + 1}{/if}
            </span>
            <Cover cover={song.cover} class='qcover' />
            <span class='text'>
              <span class='title' lang={song.lang}>{song.title}</span>
              <span class='artist' lang={song.lang}>{artistLine(song)}</span>
            </span>
            <span class='dur tnum'>{formatDuration(song.duration)}</span>
            {#if !isCurrent}
              <button type='button' class='remove' aria-label='从播放队列移除：{song.title}' onclick={() => player.removeAt(i)}>
                <X size={16} strokeWidth={2} />
              </button>
            {:else}
              <span class='remove-gap'></span>
            {/if}
          </div>
        {/snippet}
      </VirtualList>
    {/if}
  </div>
</section>

<style>
  .queue {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 18px 16px 12px 20px;
  }

  .head-text {
    flex: 1;
    min-width: 0;
  }

  h2 {
    margin: 0;
    font-size: 17px;
    line-height: 24px;
    font-weight: 600;
    color: #111827;
  }

  .head-text p {
    margin: 2px 0 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12.5px;
    line-height: 18px;
    color: #4b5563;
  }

  .clear {
    height: 32px;
    padding: 0 14px;
    border: 1px solid #e5e7eb;
    border-radius: 9999px;
    font-size: 13px;
    color: #374151;
  }

  .clear:disabled {
    color: #9ca3af;
  }

  .close {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 9999px;
    color: #4b5563;
  }

  .scroller {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0 8px 12px;
  }

  .item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    height: 56px;
    padding: 0 4px 0 8px;
    border-radius: 10px;
  }

  .hit {
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }

  .hit:focus-visible {
    outline-offset: -2px;
  }

  .lead {
    position: relative;
    display: flex;
    flex: none;
    justify-content: center;
    width: 30px;
    font-size: 12px;
    color: #6b7280;
    pointer-events: none;
  }

  .item :global(.qcover) {
    position: relative;
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 6px;
    pointer-events: none;
  }

  .text {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    pointer-events: none;
  }

  .title,
  .artist {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .title {
    font-size: 14px;
    line-height: 21px;
    color: #111827;
  }

  .artist {
    font-size: 12px;
    line-height: 17px;
    color: #4b5563;
  }

  .dur {
    position: relative;
    font-size: 12px;
    color: #6b7280;
    pointer-events: none;
  }

  .remove,
  .remove-gap {
    position: relative;
    display: grid;
    flex: none;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 9999px;
    color: #6b7280;
  }

  .current {
    background: #e8f8f1;
  }

  .current .title {
    color: #1a5b43;
    font-weight: 500;
  }

  .current .artist {
    color: #206f52;
  }

  .off .text,
  .off :global(.qcover) {
    opacity: 0.45;
  }

  @media (hover: hover) and (pointer: fine) {
    .item:not(.current):hover {
      background: #f9fafb;
    }

    .remove:hover,
    .close:hover {
      background: #f3f4f6;
      color: #111827;
    }

    .clear:not(:disabled):hover {
      border-color: #d1d5db;
      background: #f9fafb;
    }
  }
</style>

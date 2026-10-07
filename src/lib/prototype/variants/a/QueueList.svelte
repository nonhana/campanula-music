<!--
  PROTOTYPE：播放队列（虚拟列表，自带滚动容器）。当前歌曲那一行是“晨光行”；每行可移除；顶部写明播放来源，可清空。
-->
<script lang='ts'>
  import type { Song } from '$lib/prototype/data'
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine, formatCount, formatDuration, langOf } from '$lib/prototype/data'
  import { player } from '$lib/prototype/player.svelte'
  import VirtualList from '$lib/prototype/VirtualList.svelte'
  import { ListX, X } from '@lucide/svelte'
  import MorningWash from './MorningWash.svelte'
  import NowBars from './NowBars.svelte'
  import SongBadges from './SongBadges.svelte'

  interface Props {
    phone?: boolean
    class?: string
  }

  const { phone = false, class: klass = '' }: Props = $props()

  const ROW = $derived(phone ? 60 : 56)
  let scroller = $state<HTMLElement | null>(null)

  // 打开时把当前歌曲滚到第二行的位置
  $effect(() => {
    if (!scroller)
      return
    scroller.scrollTop = Math.max(0, player.index * ROW - ROW)
  })
</script>

<div class={['flex min-h-0 flex-col', klass]}>
  <div class={['flex flex-none items-center gap-3', phone ? 'px-5 pb-3' : 'px-5 pt-4 pb-3']}>
    <div class='min-w-0 flex-1'>
      <h3 class='text-[17px] leading-6 font-600 text-neutral-900'>播放队列</h3>
      <p class='truncate text-[13px] leading-5 text-neutral-600'>
        来自「<span lang={langOf(player.source.name)}>{player.source.name}</span>」<span class='tnum'> · {formatCount(player.queue.length)} 首</span>
      </p>
    </div>
    <button
      class='clear inline-flex h-9 flex-none items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 text-[13px] font-500 text-neutral-700'
      disabled={player.queue.length === 0}
      onclick={() => player.clear()}
    >
      <ListX size={16} aria-hidden='true' />清空
    </button>
  </div>

  <div bind:this={scroller} class={['min-h-0 flex-1 overflow-y-auto overscroll-contain', phone ? 'px-3 pb-6' : 'px-2 pb-2']}>
    <VirtualList items={player.queue} itemHeight={ROW} scrollParent={scroller} getKey={(s: Song, i: number) => `${s.id}-${i}`}>
      {#snippet row(song: Song, i: number)}
        {@const now = i === player.index}
        <div
          class={['qrow relative h-full rounded-xl', !player.playable(song) && 'opacity-45']}
          role='presentation'
        >
          {#if now}<MorningWash start={92} />{/if}
          <div class='relative grid h-full grid-cols-[28px_40px_minmax(0,1fr)_auto_36px] items-center gap-3 pl-2 pr-1'>
            <span class='grid place-items-center text-[12px] text-neutral-500 tnum'>
              {#if now}<NowBars playing={player.playing} />{:else}{i + 1}{/if}
            </span>
            <Cover cover={song.cover} class='size-10 rounded-lg' />
            <button
              class='play-target min-w-0 text-left'
              disabled={!player.playable(song)}
              aria-current={now ? 'true' : undefined}
              onclick={() => player.playFrom(player.queue, i, player.source)}
            >
              <span class='flex min-w-0 items-center gap-1.5'>
                <span class={['truncate text-[14px] font-500', now ? 'text-primary-950' : 'text-neutral-900']} lang={song.lang}>{song.title}</span>
                <SongBadges {song} />
              </span>
              <span class='block truncate text-[12.5px] text-neutral-600' lang={song.lang}>{artistLine(song)}</span>
            </button>
            <span class='text-[12.5px] text-neutral-500 tnum'>{formatDuration(song.duration)}</span>
            <button
              class='ghost relative z-1 grid size-9 place-items-center rounded-lg text-neutral-500'
              aria-label='从播放队列移除'
              disabled={now}
              onclick={() => player.removeAt(i)}
            >
              <X size={16} aria-hidden='true' />
            </button>
          </div>
        </div>
      {/snippet}
    </VirtualList>
  </div>
</div>

<style>
  .play-target::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 12px;
  }

  .play-target:disabled {
    cursor: not-allowed;
  }

  .clear:disabled {
    opacity: 0.5;
  }

  .ghost:disabled {
    visibility: hidden;
  }

  @media (hover: hover) and (pointer: fine) {
    .qrow:hover {
      background: rgb(245 252 249 / 0.9);
    }

    .clear:not(:disabled):hover {
      border-color: #80dbb9;
    }

    .ghost:hover {
      background: #e8f8f1;
      color: #1a5b43;
    }
  }
</style>

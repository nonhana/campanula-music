<!--
  播放页里的播放队列（自己滚动的虚拟列表）：头部写明有几首、都来自同一个播放来源时写来自哪里；
  56px 一行：序号（正在放的换成三根小竖条）、封面、歌名歌手、时长。轻点一行就放这一首，播放队列不变；
  正在放的那行是晨光行；无版权的整行降到 45%、不能点。打开时当前这首停在第二行的位置。
  移出某首、清空和播放模式由 #26 加
-->
<script lang='ts'>
  import type { QueueEntry } from '$lib/app/player'
  import type { ClassValue } from 'svelte/elements'
  import { untrack } from 'svelte'
  import { getAppView } from '../app-context.svelte'
  import Cover from '../library/Cover.svelte'
  import PlayTarget from '../library/PlayTarget.svelte'
  import SongBadge from '../library/SongBadge.svelte'
  import { artistLine, formatCount, formatDuration, langOf } from '../library/view'
  import VirtualList from '../library/VirtualList.svelte'
  import MorningWash from './MorningWash.svelte'
  import NowBars from './NowBars.svelte'
  import { sourceName } from './view'

  const { class: klass }: { class?: ClassValue } = $props()

  const ROW = 56
  const uid = $props.id()
  const view = getAppView()
  const queue = $derived(view.state.player.queue)
  const current = $derived(view.state.player.current)
  /** 播放队列里的歌都来自同一个播放来源时，它叫什么 */
  const source = $derived.by(() => {
    const first = queue[0]?.source
    if (!first || !queue.every(entry => entry.source.kind === first.kind && entry.source.id === first.id))
      return null
    return sourceName(view.state.library, first)
  })

  let scroller = $state<HTMLElement>()

  // 打开时把当前这首滚到第二行的位置；之后换歌不动听众自己滚到的地方
  $effect(() => {
    if (scroller)
      scroller.scrollTop = Math.max(0, (untrack(() => current) ?? 0) * ROW - ROW)
  })
</script>

<section class={['flex min-h-0 flex-col', klass]} aria-labelledby='{uid}-title'>
  <header class='flex-none px-5 pb-2 pt-4'>
    <h2 id='{uid}-title' class='text-title-sm text-neutral-900 font-600'>播放队列</h2>
    <p class='truncate text-caption text-neutral-600'>
      {#if source}来自「<span lang={langOf(source)}>{source}</span>」<span class='mr-1' aria-hidden='true'>·</span>{/if}<span class='tabular-nums'>{formatCount(queue.length)} 首</span>
    </p>
  </header>

  <div bind:this={scroller} class='min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2'>
    <VirtualList items={queue} itemHeight={ROW} scrollParent={scroller} getKey={(entry: QueueEntry, i: number) => `${entry.song.id}-${i}`}>
      {#snippet row(entry: QueueEntry, i: number)}
        {@const now = i === current}
        {@const off = entry.song.availability === 'noCopyright'}
        <div class={['relative h-full rounded-lg', !off && 'mouse:hover:bg-neutral-50']}>
          {#if now}<MorningWash start={92} />{/if}
          <div class={['relative grid grid-cols-[28px_40px_minmax(0,1fr)_auto] h-full items-center gap-3 pl-2 pr-3', off && 'opacity-45']}>
            <span class='grid place-items-center text-caption text-neutral-500 tabular-nums'>
              {#if now}<NowBars />{:else}{i + 1}{/if}
            </span>
            <Cover url={entry.song.album.coverUrl} size={40} class='rounded-md' />
            <PlayTarget class='min-w-0' rounded disabled={off} {now} onplay={() => view.app.playFromQueue(i)}>
              <span class='min-w-0 flex items-center gap-2'>
                <span class={['truncate text-label font-500', now ? 'text-primary-950' : 'text-neutral-900']} lang={langOf(entry.song.name)}>{entry.song.name}</span>
                <SongBadge availability={entry.song.availability} />
              </span>
              <span class='block truncate text-caption text-neutral-600' lang={langOf(artistLine(entry.song))}>{artistLine(entry.song)}</span>
            </PlayTarget>
            <span class='text-caption text-neutral-500 tabular-nums'>{formatDuration(entry.song.duration)}</span>
          </div>
        </div>
      {/snippet}
    </VirtualList>
  </div>
</section>

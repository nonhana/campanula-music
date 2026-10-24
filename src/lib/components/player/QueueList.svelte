<!--
  播放页里的播放队列（自己滚的虚拟列表，原型 QueueList）：头部写有几首（来源在播放页顶上已写），右边“清空”（点了直接清空、没有撤销，
  手机用文字、桌面描边胶囊，#57）。标题“播放队列”桌面只给读屏，手机弹层照旧显示。56px 一行：序号（正在放的是三根小竖条）、
  封面、歌名歌手、时长、移出键；轻点一行放这首、队列不变；正在放的那行是晨光行、移不掉；现在放不了的整行降到 45%、不能点但能移出。
  打开时当前这首停在第二行。歌名、歌手、徽标和歌曲行共用 songs/SongTitle，行高是 songs/view 的 SONG_ROW_HEIGHT。
  清空后队列空、停下，播放页跟着收起；移出后焦点落在下一首的移出键（最后一首是上一首的，正在放的那首落在“清空”）。
-->
<script lang='ts'>
  import { ListX, X } from '@lucide/svelte'
  import { tick, untrack } from 'svelte'
  import type { ClassValue } from 'svelte/elements'

  import type { QueueEntry } from '#lib/app/player.js'

  import { getAppView } from '../shared/app-context.svelte'
  import { fade } from '../shared/motion'
  import { setScrollLookup } from '../shared/scroll-marks'
  import { formatCount, formatDuration } from '../shared/text'
  import MorningWash from '../songs/MorningWash.svelte'
  import NowIndex from '../songs/NowIndex.svelte'
  import PlayTarget from '../songs/PlayTarget.svelte'
  import { songLook } from '../songs/song-look'
  import SongTitle from '../songs/SongTitle.svelte'
  import { SONG_ROW_HEIGHT, songMark } from '../songs/view'
  import Cover from '../ui/Cover.svelte'
  import Scrollbar from '../ui/Scrollbar.svelte'
  import TextButton from '../ui/TextButton.svelte'
  import VirtualList from '../ui/VirtualList.svelte'
  import { playerPageActions } from './player-page.svelte'

  const { class: klass }: { class?: ClassValue } = $props()
  const { closePlayerPage } = playerPageActions()

  const ROW = SONG_ROW_HEIGHT
  const uid = $props.id()
  const view = getAppView()
  /** 气泡问队列最上面是哪一首 */
  const lookup = setScrollLookup({ markAt: null })
  const queue = $derived(view.state.player.queue)
  const current = $derived(view.state.player.current)

  let scroller = $state<HTMLElement>()

  // 打开时把当前这首滚到第二行；之后换歌不动听众自己滚到的地方
  $effect(() => {
    if (scroller)
      scroller.scrollTop = Math.max(0, (untrack(() => current) ?? 0) * ROW - ROW)
  })

  let section = $state<HTMLElement>()

  const remove = async (index: number) => {
    view.app.removeFromQueue(index)
    await tick()
    // 下一首的移出键；最后一首就是上一首的；正在放的那首没有移出键，落在“清空”上
    const next = Math.min(index, view.state.player.queue.length - 1)
    const target = scroller?.querySelector<HTMLElement>(`[data-remove="${next}"]:not([inert])`) ?? section?.querySelector<HTMLElement>('[data-clear]')
    target?.focus()
  }

  const clear = () => {
    closePlayerPage()
    view.app.clearQueue()
  }
</script>

<section bind:this={section} class={['flex min-h-0 flex-col', klass]} aria-labelledby='{uid}-title'>
  <header class='flex flex-none items-center gap-3 px-5 pb-2 pt-4'>
    <div class='min-w-0 flex-1'>
      <h2 id='{uid}-title' class='text-title-sm text-neutral-900 font-600 md:sr-only'>播放队列</h2>
      <p class='truncate text-caption text-neutral-600 tabular-nums'>{formatCount(queue.length)} 首</p>
    </div>
    <TextButton tone='neutral' desktop={{ variant: 'outline', icon: ListX }} class='max-md:-mr-3 md:h-9! md:pl-3.5! md:pr-4!' data-clear onclick={clear}>清空</TextButton>
  </header>

  <!-- 底下的 8px 留在滚动区外：滚动条下端不伸进面板圆角 -->
  <div bind:this={scroller} class='mb-2 min-h-0 flex-1 overflow-y-auto overscroll-contain'>
    <Scrollbar {lookup} />
    <div class='px-2'>
      <VirtualList items={queue} itemHeight={ROW} scrollParent={scroller} getKey={(entry: QueueEntry) => entry.song.id} markOf={(entry: QueueEntry, i: number) => songMark(entry.song, i)}>
        {#snippet row(entry: QueueEntry, i: number)}
          {@const now = i === current}
          {@const look = songLook(view, entry.song)}
          {@const off = look.off}
          <div class={['relative h-full rounded-lg', !off && 'mouse:hover:bg-neutral-50']}>
            {#if now}<MorningWash start={92} />{/if}
            <div class={['relative grid grid-cols-[28px_40px_minmax(0,1fr)_auto_36px] h-full items-center gap-3 pl-2 pr-1', off && 'opacity-45']}>
              <NowIndex n={i + 1} {now} />
              <Cover url={entry.song.album.coverUrl} size={40} class='rounded-md' />
              <PlayTarget class='min-w-0' rounded disabled={off} {now} onplay={() => view.app.playFromQueue(i)}>
                <SongTitle song={entry.song} {now} {look} />
              </PlayTarget>
              <span class='text-caption text-neutral-500 tabular-nums'>{formatDuration(entry.song.duration)}</span>
              <!-- 正在放的那首没有移出键：换歌时新旧两行一个淡出、一个淡入 -->
              <span class='grid size-9'>
                {#if !now}
                  <button
                    type='button'
                    class='relative z-1 grid size-9 place-items-center rounded-lg text-neutral-500 transition-colors duration-feedback mouse:hover:(bg-primary-100 text-primary-950)'
                    aria-label='从播放队列移出：{entry.song.name}'
                    data-remove={i}
                    onclick={() => remove(i)}
                    transition:fade
                  >
                    <X size={16} aria-hidden='true' />
                  </button>
                {/if}
              </span>
            </div>
          </div>
        {/snippet}
      </VirtualList>
    </div>
  </div>
</section>

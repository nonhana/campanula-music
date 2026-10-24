<!--
  播放页里的播放队列（自己滚动的虚拟列表，原型 QueueList）：头部写有几首（来源在播放页顶上已经写着），右边“清空”
  （点了直接清空、没有撤销，所以手机写字不用图标：TextButton，桌面是描边胶囊，#57）。
  标题“播放队列”在桌面只给读屏（上面的标签已经写着），手机弹层上照旧显示；
  56px 一行：序号（正在放的换成三根小竖条）、封面、歌名歌手、时长、移出键。轻点一行就放这一首，播放队列不变；
  正在放的那行是晨光行，它移不掉（移出键的位置空着）；现在放不了的（无版权；断网、没登录时没下载的，#38）整行降到 45%、不能点，但能移出。打开时当前这首停在第二行的位置。
  歌名、歌手、徽标这一块和歌曲行共用 songs/SongTitle；行高是 songs/view 的 SONG_ROW_HEIGHT。
  清空：播放队列空了、停下，播放页跟着收起（播放条沉下去）。移出一首后焦点落在下一首的移出键上（最后一首时是上一首的，那是正在放的那首时落在“清空”上）
-->
<script lang='ts'>
  import type { ClassValue } from 'svelte/elements'
  import type { QueueEntry } from '#lib/app/player.js'
  import { ListX, X } from '@lucide/svelte'
  import { tick, untrack } from 'svelte'
  import { getAppView } from '../app-context.svelte'
  import { fade } from '../motion'
  import MorningWash from '../songs/MorningWash.svelte'
  import NowIndex from '../songs/NowIndex.svelte'
  import PlayTarget from '../songs/PlayTarget.svelte'
  import { songLook } from '../songs/song-look'
  import SongTitle from '../songs/SongTitle.svelte'
  import { SONG_ROW_HEIGHT, songMark } from '../songs/view'
  import { formatCount, formatDuration } from '../text'
  import Cover from '../ui/Cover.svelte'
  import { setScrollLookup } from '../ui/scroll-marks'
  import Scrollbar from '../ui/Scrollbar.svelte'
  import TextButton from '../ui/TextButton.svelte'
  import VirtualList from '../ui/VirtualList.svelte'
  import { playerPageActions } from './player-page.svelte'

  const { class: klass }: { class?: ClassValue } = $props()
  const { closePlayerPage } = playerPageActions()

  const ROW = SONG_ROW_HEIGHT
  const uid = $props.id()
  const view = getAppView()
  /** 按住滚动条拖时，气泡问队列最上面是哪一首 */
  const lookup = setScrollLookup({ markAt: null })
  const queue = $derived(view.state.player.queue)
  const current = $derived(view.state.player.current)

  let scroller = $state<HTMLElement>()

  // 打开时把当前这首滚到第二行的位置；之后换歌不动听众自己滚到的地方
  $effect(() => {
    if (scroller)
      scroller.scrollTop = Math.max(0, (untrack(() => current) ?? 0) * ROW - ROW)
  })

  let section = $state<HTMLElement>()

  async function remove(index: number) {
    view.app.removeFromQueue(index)
    await tick()
    // 下一首的移出键；移的是最后一首就是上一首的；它是正在放的那首（没有移出键）时落在“清空”上
    const next = Math.min(index, view.state.player.queue.length - 1)
    const target = scroller?.querySelector<HTMLElement>(`[data-remove="${next}"]:not([inert])`) ?? section?.querySelector<HTMLElement>('[data-clear]')
    target?.focus()
  }

  function clear() {
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

  <!-- 底下的 8px 留在滚动区外面：滚动条的下端不伸进面板的圆角 -->
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
              <!-- 正在放的那首没有移出键：换歌时新旧两行的移出键一个淡出、一个淡入 -->
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

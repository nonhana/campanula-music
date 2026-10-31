<!--
  播放队列（自己滚的虚拟列表，原型 QueueList）：头部写有几首（来源在播放页顶上已写），右边“清空”（点了直接清空、没有撤销，
  手机用文字、桌面描边胶囊，#57）。标题“播放队列”桌面只给读屏（桌面播放队列面板传 titled 显示），手机弹层照旧显示。56px 一行：序号（正在放的是三根小竖条）、
  封面、歌名歌手、时长、移出键；轻点一行放这首、队列不变；正在放的那行是晨光行、移不掉；现在放不了的整行降到 45%、不能点但能移出。
  每次出现在眼前（挂上时看得见，或 shown 由 false 变 true）都在下一次绘制前把当前这首直接放到第二行，不滚给人看；看得见时换歌不动听众自己滚到的地方。
  它自己是“定位到正在播放”的主人也是列表（shared/now-locate）：当前这首滚出去时右下角淡入定位按钮。
  ground：放在播放页的封面染底上（桌面播放页），没有白底；晨光行用薄荷玻璃、悬停是半透明白、时长序号移出键用石墨（石墨淡只放在白底或晨光底上），
  滚动区上下各 24px 渐隐；滚动条和定位按钮在滚动区外面，不跟着淡。手机弹层和桌面面板是白底。
  歌名、歌手、徽标和歌曲行共用 songs/SongTitle，行高是 songs/view 的 SONG_ROW_HEIGHT。
  清空后队列空、停下，播放页跟着收起；移出后焦点落在下一首的移出键（最后一首是上一首的，正在放的那首落在“清空”）。
-->
<script lang='ts'>
  import { ListX, X } from '@lucide/svelte'
  import { tick, untrack } from 'svelte'
  import type { ClassValue } from 'svelte/elements'

  import { songTitle } from '#lib/api/library.js'
  import type { QueueEntry } from '#lib/app/player.js'

  import { getAppView } from '../shared/app-context.svelte'
  import { fade } from '../shared/motion'
  import { createNowLocate, focusNowRow } from '../shared/now-locate.svelte'
  import { setScrollLookup } from '../shared/scroll-marks'
  import { formatCount, formatDuration } from '../shared/text'
  import LocateNowButton from '../songs/LocateNowButton.svelte'
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

  interface Props {
    /** 放在封面染底上（桌面播放页） */
    ground?: boolean
    /** 现在看不看得见（桌面播放页切到别的标签时是 false） */
    shown?: boolean
    /** 桌面也显示标题（桌面播放队列面板） */
    titled?: boolean
    class?: ClassValue
  }

  const { ground = false, shown = true, titled = false, class: klass }: Props = $props()
  const { closePlayerPage } = playerPageActions()

  const ROW = SONG_ROW_HEIGHT
  const uid = $props.id()
  const view = getAppView()
  /** 气泡问队列最上面是哪一首 */
  const lookup = setScrollLookup({ markAt: null })
  const queue = $derived(view.state.player.queue)
  const current = $derived(view.state.player.current)

  let scroller = $state<HTMLElement>()

  // 出现在眼前时把当前这首放到第二行；看得见时换歌不动听众自己滚到的地方。
  // 等这一轮更新画完再放（仍在下一次绘制前）：手机弹层的高度由外层抽屉在同一轮里才定下，之前滚动区还滚不动
  $effect(() => {
    if (!scroller || !shown)
      return
    const el = scroller
    const top = Math.max(0, (untrack(() => current) ?? 0) * ROW - ROW)
    void tick().then(() => {
      el.scrollTop = top
    })
  })

  const locate = createNowLocate({
    scroller: () => scroller ?? null,
    band: () => {
      const rect = scroller!.getBoundingClientRect()
      return { top: rect.top, bottom: rect.bottom }
    },
  })
  $effect(() => locate.register({
    row: () => current === null || !scroller
      ? null
      : {
        top: scroller.getBoundingClientRect().top - scroller.scrollTop + current * ROW,
        height: ROW,
        first: current === 0,
      },
    focus: () => focusNowRow(scroller),
  }))

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
      <h2 id='{uid}-title' class={['text-title-sm text-neutral-900 font-600', !titled && 'md:sr-only']}>播放队列</h2>
      <p class='truncate text-caption text-neutral-600 tabular-nums'>{formatCount(queue.length)} 首</p>
    </div>
    <TextButton tone='neutral' desktop={{ variant: 'outline', icon: ListX }} class='max-md:-mr-3 md:h-9! md:pl-3.5! md:pr-4!' data-clear onclick={clear}>清空</TextButton>
  </header>

  <!-- 底下的 8px 留在滚动区外：滚动条下端不伸进面板圆角。滚动条、定位按钮放在滚动区外面，不跟着渐隐淡掉 -->
  <div class='relative mb-2 min-h-0 flex flex-1 flex-col'>
    <div bind:this={scroller} class={['min-h-0 flex-1 overflow-y-auto overscroll-contain', ground && 'fade-edges']}>
      <div class='px-2'>
        <VirtualList items={queue} itemHeight={ROW} scrollParent={scroller} getKey={(entry: QueueEntry) => entry.song.id} markOf={(entry: QueueEntry, i: number) => songMark(entry.song, i)}>
          {#snippet row(entry: QueueEntry, i: number)}
            {@const now = i === current}
            {@const look = songLook(view, entry.song)}
            {@const off = look.off}
            <div class={['relative h-full rounded-lg', !off && (ground ? 'mouse:hover:bg-white/60' : 'mouse:hover:bg-neutral-50')]}>
              {#if now}<MorningWash start={92} onGround={ground} />{/if}
              <div class={['relative grid grid-cols-[28px_40px_minmax(0,1fr)_auto_36px] h-full items-center gap-3 pl-2 pr-1', off && 'opacity-45']}>
                <NowIndex n={i + 1} {now} onGround={ground} />
                <Cover url={entry.song.album.coverUrl} size={40} class='rounded-md' />
                <PlayTarget class='min-w-0' rounded disabled={off} {now} onplay={() => view.app.playFromQueue(i)}>
                  <SongTitle song={entry.song} {now} {look} />
                </PlayTarget>
                <!-- 网易云没给时长（#78）：留着这一格，行里各列对齐 -->
                <span class={[
                  'text-caption tabular-nums',
                  ground ? 'text-neutral-600' : 'text-neutral-500',
                ]}>{#if entry.song.duration !== null}{formatDuration(entry.song.duration)}{/if}</span>
                <!-- 正在放的那首没有移出键：换歌时新旧两行一个淡出、一个淡入 -->
                <span class='grid size-9'>
                  {#if !now}
                    <button
                      type='button'
                      class={[
                        'relative z-1 grid size-9 place-items-center rounded-lg transition-colors duration-feedback mouse:hover:(bg-primary-100 text-primary-950)',
                        ground ? 'text-neutral-600' : 'text-neutral-500',
                      ]}
                      aria-label='从播放队列移出：{songTitle(entry.song)}'
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
    <Scrollbar {lookup} target={scroller} />
    <!-- 离右边 24px（让开滚动条贴边 16px 的悬停带）、下边 16px -->
    <LocateNowButton {locate} class='absolute bottom-4 right-6 z-1' />
  </div>
</section>

<style>
  /* 和歌词一样，滚出去的行是淡掉的 */
  .fade-edges {
    mask-image: linear-gradient(180deg, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%);
  }
</style>

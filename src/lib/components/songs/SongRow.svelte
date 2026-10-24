<!--
  歌曲行（56px，DESIGN.md Song Row）：桌面行、手机行同一份。序号、封面和歌名歌手、专辑、状态（红心键，始终可见；后面跟着下载标记）、时长、•••；
  手机没有专辑和时长，封面中间压“正在播放”的小圆片。单击（轻点）整行就播放；••• 始终可见，右键（键盘的菜单键）打开同一份“更多”菜单；
  红心键和 ••• 压在整行的点歌按钮上面，点它们不放歌。正在播放的那行是晨光行。
  点歌时这一行的封面飞进播放条（PlayTarget 的 cover）。现在放不了的整行降到 45%、不能点，徽标写明原因；红心键、••• 照样能点。
  下载了的歌永远能放（ADR-0006）。多选时前面是勾选框（手机长按也能进来），••• 换成拖动把手。
  六列的宽度和每列的对齐写在 SONG_GRID / SONG_COLUMNS 里，表头和骨架行用的是同一份
-->
<script module lang='ts'>
  /** 桌面歌曲行的六列网格：行、表头、骨架行共用 */
  export const SONG_GRID = 'grid grid-cols-[36px_minmax(0,1.25fr)_minmax(0,1fr)_112px_48px_40px] items-center gap-4 pl-2 pr-1'
  /** 每列的对齐，表头那一格和行里那一格用同一个（justify-self，文字、按钮都一样对齐） */
  export const SONG_COLUMNS = {
    index: 'justify-self-center',
    title: '',
    album: '',
    status: 'justify-self-center',
    duration: 'justify-self-end',
    more: '',
  } as const
</script>

<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { Song } from '#lib/api/library.js'
  import type { PlaySource } from '#lib/api/playback.js'
  import { Check } from '@lucide/svelte'
  import { songMenuActions } from '../menu/song-menu.svelte'
  import { getAppView } from '../shared/app-context.svelte'
  import { formatDuration, langOf } from '../shared/text'
  import Cover from '../ui/Cover.svelte'
  import DownloadMark from './DownloadMark.svelte'
  import DragCountBadge from './DragCountBadge.svelte'
  import HeartButton from './HeartButton.svelte'
  import MorningWash from './MorningWash.svelte'
  import NowChip from './NowChip.svelte'
  import NowIndex from './NowIndex.svelte'
  import PlayTarget from './PlayTarget.svelte'
  import { songLook } from './song-look'
  import SongMoreButton from './SongMoreButton.svelte'
  import SongTitle from './SongTitle.svelte'

  const { openSongMenuAt } = songMenuActions()

  interface Props {
    song: Song
    /** 这一行所在的列表：从“更多”菜单放进播放队列时的播放来源 */
    source: PlaySource
    /** 手机行（Auxio 式）；默认是桌面行 */
    phone?: boolean
    /** 桌面行的序号，从 1 开始 */
    n?: number
    /** 正在播放这首 */
    now: boolean
    onplay: () => void
    /** 多选模式：每行前面是勾选框 */
    selecting?: boolean
    selected?: boolean
    /** 桌面的 ⌘/Ctrl 点选、Shift 连选：会进入同一个多选状态 */
    onselect?: (event: MouseEvent) => void
    /** 手机长按到 400ms（还没挪动）：进入多选并选中这一首；from 是这一行能接焦点的按钮，退出多选后焦点还给它 */
    onlongpress?: (from: HTMLElement) => void
    /** 拖动把手（#36）：多选里能排序的歌单才有；给了就替换右边的 ••• */
    grip?: Snippet<[Song]>
    /** 浮起的复制行：影子、不接指针，一起拖几首时显示数量 */
    ghost?: boolean
    count?: number
  }

  const { song, source, phone = false, n = 0, now, onplay, selecting = false, selected = false, onselect, onlongpress, grip, ghost = false, count = 1 }: Props = $props()
  const view = getAppView()
  const look = $derived(songLook(view, song))
  const off = $derived(look.off)
  /** 这一行的封面：点歌时它飞进播放条 */
  let cover = $state<HTMLElement>()

  /** 长按 400ms 进入多选（Spec #11）：挪动超过 10px 就是滚动，不算 */
  const LONG_PRESS = 400
  const MOVE_SLOP = 10
  let timer: ReturnType<typeof setTimeout> | undefined
  let origin: { x: number, y: number } | null = null
  /**
   * 这一次的长按已经进入多选：松手后的那一下点按不要再当成勾选（长按进入后紧接着的连点照常算）。
   * 不按时间清：按住超过 1 秒再松手时，那一下点按也要吞掉；下一次 pointerdown 才复位
   */
  let longPressed = false

  // 虚拟列表把这一行回收、或者离开页面：不要再触发长按
  $effect(() => () => {
    if (timer)
      clearTimeout(timer)
  })

  function cancelLongPress(): void {
    if (timer)
      clearTimeout(timer)
    timer = undefined
    origin = null
  }

  function down(event: PointerEvent): void {
    if (ghost || selecting || event.pointerType === 'mouse' || (event.target as Element).closest('[data-more], [data-grip]'))
      return
    // 长按进入多选后，退出时焦点回到这一行能接焦点的按钮（不在模块里查全局 DOM）
    const from = (event.target as Element).closest<HTMLElement>('[data-play-target]')
      ?? (event.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-play-target]')
      ?? (event.currentTarget as HTMLElement)
    origin = { x: event.clientX, y: event.clientY }
    longPressed = false
    timer = setTimeout(() => {
      timer = undefined
      longPressed = true
      onlongpress?.(from)
    }, LONG_PRESS)
  }

  function move(event: PointerEvent): void {
    if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > MOVE_SLOP)
      cancelLongPress()
  }

  function activate(): void {
    if (longPressed) {
      longPressed = false
      return
    }
    onplay()
  }

  /** 多选时整行都能点：点在按钮（点歌、红心、•••）上时不重复处理 */
  function rowclick(event: MouseEvent): void {
    if (selecting && !(event.target as Element).closest('button'))
      activate()
  }
</script>

<div
  class={['row relative h-full rounded-lg', selected && 'bg-primary-100', ghost && 'bg-white shadow-float', !off && !selected && !phone && 'mouse:hover:bg-neutral-50', phone && 'row-touch']}
  role='presentation'
  data-song-id={song.id}
  oncontextmenu={event => openSongMenuAt(event, song, source)}
  onclick={rowclick}
  onpointerdown={phone ? down : undefined}
  onpointermove={phone ? move : undefined}
  onpointerup={phone ? cancelLongPress : undefined}
  onpointercancel={phone ? cancelLongPress : undefined}
  onpointerleave={phone ? cancelLongPress : undefined}
>
  {#if now && !ghost}
    {#if phone}<MorningWash start={selecting ? 104 : 70} onGround />{:else}<MorningWash start={104} />{/if}
  {/if}
  {#if phone}
    <div class={['relative grid h-full items-center', selecting ? (grip ? 'grid-cols-[22px_48px_minmax(0,1fr)_44px] gap-3 pl-3 pr-1' : 'grid-cols-[22px_48px_minmax(0,1fr)] gap-3 pl-3 pr-1') : 'grid-cols-[48px_minmax(0,1fr)_44px] gap-3.5 pl-4 pr-1', off && !selected && 'opacity-45']}>
      {#if selecting}
        <span
          class={[
            'grid size-[22px] flex-none place-items-center rounded-md border-[1.5px]',
            selected ? 'border-primary-900 bg-primary-900 text-white' : 'border-neutral-500 bg-white',
          ]}
          aria-hidden='true'
        >
          {#if selected}<Check size={14} strokeWidth={3} />{/if}
        </span>
      {/if}
      <span class='relative size-12' bind:this={cover}>
        <Cover url={song.album.coverUrl} size={48} class='rounded-md' />
        {#if now && !ghost}<NowChip />{/if}
        <DragCountBadge {count} />
      </span>
      <PlayTarget class='min-w-0' disabled={off && !selecting} unplayable={off} {now} {cover} {selecting} {selected} onplay={activate} keyshortcuts={grip ? 'Alt+ArrowUp Alt+ArrowDown' : undefined}>
        <SongTitle {song} {now} {look} size='body' mark tight />
      </PlayTarget>
      {#if grip}
        {@render grip(song)}
      {:else if !selecting}
        <SongMoreButton {song} {source} size='phone' />
      {/if}
    </div>
  {:else}
    <div class={['relative h-full', SONG_GRID, off && !selected && 'opacity-45']}>
      <span class={SONG_COLUMNS.index}>
        {#if selecting}
          <span
            class={[
              'grid size-[18px] place-items-center rounded-sm border-[1.5px]',
              selected ? 'border-primary-900 bg-primary-900 text-white' : 'border-neutral-500 bg-white',
            ]}
            aria-hidden='true'
          >
            {#if selected}<Check size={12} strokeWidth={3} />{/if}
          </span>
        {:else}
          <NowIndex {n} {now} />
        {/if}
      </span>
      <span class={['min-w-0 flex items-center gap-3', SONG_COLUMNS.title]}>
        <span class='relative flex-none' bind:this={cover}>
          <Cover url={song.album.coverUrl} size={40} class='rounded-md' />
          <DragCountBadge {count} />
        </span>
        <PlayTarget class='min-w-0 flex-1' rounded disabled={off && !selecting && !onselect} unplayable={off} {now} {cover} onplay={activate} {selecting} {selected} {onselect} keyshortcuts={grip ? 'Alt+ArrowUp Alt+ArrowDown' : undefined}>
          <SongTitle {song} {now} {look} />
        </PlayTarget>
      </span>
      <span class={['truncate text-caption text-neutral-600', SONG_COLUMNS.album]} lang={langOf(song.album.name ?? '')}>{song.album.name}</span>
      <span class={['flex items-center gap-2', SONG_COLUMNS.status]}>
        <HeartButton {song} size='row' />
        {#if look.mark}<DownloadMark mark={look.mark} variant='column' />{/if}
      </span>
      <span class={['text-caption text-neutral-500 tabular-nums', SONG_COLUMNS.duration]}>{formatDuration(song.duration)}</span>
      {#if grip}
        {@render grip(song)}
      {:else}
        <SongMoreButton {song} {source} size='desktop' />
      {/if}
    </div>
  {/if}
</div>

<style>
  /* 手机行只有上下手势：拖动排序的把手自己拦；桌面行不拦文字选择 */
  .row-touch {
    -webkit-touch-callout: none;
    user-select: none;
    touch-action: pan-y;
  }
</style>

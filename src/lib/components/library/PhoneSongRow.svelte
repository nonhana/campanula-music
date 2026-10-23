<!--
  手机歌曲行（Auxio 式，56px，无分隔线，DESIGN.md Song Row）：封面、歌名、歌手（下载了的前面有下载标记，#38）、•••。轻点整行就播放；
  ••• 始终可见，打开“更多”菜单（触屏是底部弹层）；窄窗口里用鼠标时右键打开同一份菜单。
  正在播放的那行是晨光行：封面中间压一枚白色小圆片，里面是三根小竖条，歌名变成森林墨。点歌时这一行的封面飞进播放条（PlayTarget 的 cover）。
  现在放不了的整行降到 45%、不能点，徽标写明原因（无版权；断网、没登录时没下载的写“未下载”）；••• 照样能点。下载了的歌永远能放
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { Song } from '#lib/api/library.js'
  import type { PlaySource } from '#lib/api/playback.js'
  import { Check } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import DownloadMark from '../downloads/DownloadMark.svelte'
  import { songLook } from '../downloads/view'
  import MorningWash from '../player/MorningWash.svelte'
  import NowChip from '../player/NowChip.svelte'
  import { songMenuActions } from '../song-menu.svelte'
  import Cover from './Cover.svelte'
  import DragCountBadge from './DragCountBadge.svelte'
  import PlayTarget from './PlayTarget.svelte'
  import SongBadge from './SongBadge.svelte'
  import SongMoreButton from './SongMoreButton.svelte'
  import { artistLine, langOf } from './view'

  const { openSongMenuAt } = songMenuActions()

  interface Props {
    song: Song
    /** 这一行所在的列表：从“更多”菜单放进播放队列时的播放来源 */
    source: PlaySource
    /** 正在播放这首 */
    now: boolean
    onplay: () => void
    /** 多选模式：前面是勾选框，••• 收起来 */
    selecting?: boolean
    selected?: boolean
    /** 长按到 400ms（还没挪动）：进入多选并选中这一首 */
    onlongpress?: () => void
    /** 拖动把手（#36）：多选里能排序的歌单才有；给了就替换右边的 ••• */
    grip?: Snippet<[Song]>
    /** 浮起的复制行：影子、不接指针，一起拖几首时显示数量 */
    ghost?: boolean
    count?: number
  }

  const { song, source, now, onplay, selecting = false, selected = false, onlongpress, grip, ghost = false, count = 1 }: Props = $props()
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
    origin = { x: event.clientX, y: event.clientY }
    longPressed = false
    timer = setTimeout(() => {
      timer = undefined
      longPressed = true
      onlongpress?.()
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

  /** 多选时整行都能点：点在按钮（点歌、•••）上时不重复处理 */
  function rowclick(event: MouseEvent): void {
    if (selecting && !(event.target as Element).closest('button'))
      activate()
  }
</script>

<div
  class={['row relative h-full rounded-lg', selected && 'bg-primary-100', ghost && 'bg-white shadow-float']}
  role='presentation'
  data-song-id={song.id}
  oncontextmenu={event => openSongMenuAt(event, song, source)}
  onclick={rowclick}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={cancelLongPress}
  onpointercancel={cancelLongPress}
  onpointerleave={cancelLongPress}
>
  {#if now && !ghost}<MorningWash start={selecting ? 104 : 70} onGround />{/if}
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
      <span class='min-w-0 flex items-center gap-1.5'>
        <span class={['truncate text-body font-500 transition-colors duration-state', now ? 'text-primary-950' : 'text-neutral-900']} lang={langOf(song.name)}>{song.name}</span>
        <SongBadge kind={look.badge} />
      </span>
      <span class='mt-0.5 flex items-center gap-1.5 text-caption text-neutral-600'>
        {#if look.mark}<DownloadMark mark={look.mark} variant='inline' />{/if}
        <span class='min-w-0 truncate' lang={langOf(artistLine(song))}>{artistLine(song)}</span>
      </span>
    </PlayTarget>
    {#if grip}
      {@render grip(song)}
    {:else if !selecting}
      <SongMoreButton {song} {source} size='phone' />
    {/if}
  </div>
</div>

<style>
  .row {
    -webkit-touch-callout: none;
    user-select: none;
    touch-action: pan-y;
  }
</style>

<!--
  桌面歌曲行（56px，DESIGN.md Song Row）：序号、封面和歌名歌手、专辑、状态（红心键，始终可见）、时长、•••。单击整行就播放；
  ••• 始终可见，右键（键盘的菜单键）打开同一份“更多”菜单。红心键和 ••• 压在整行的点歌按钮上面，点它们不放歌。
  正在播放的那行是晨光行：序号换成三根小竖条，歌名变成森林墨。点歌时这一行的封面飞进播放条（PlayTarget 的 cover）。
  无版权的整行降到 45%、不能点，徽标写明原因（红心键、••• 照样能点）。
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
  import type { Song } from '#lib/api/library.js'
  import type { PlaySource } from '#lib/api/playback.js'
  import { Check } from '@lucide/svelte'
  import MorningWash from '../player/MorningWash.svelte'
  import NowIndex from '../player/NowIndex.svelte'
  import { openSongMenuAt } from '../song-menu.svelte'
  import Cover from './Cover.svelte'
  import HeartButton from './HeartButton.svelte'
  import PlayTarget from './PlayTarget.svelte'
  import SongBadge from './SongBadge.svelte'
  import SongMoreButton from './SongMoreButton.svelte'
  import { artistLine, formatDuration, langOf } from './view'

  interface Props {
    song: Song
    /** 这一行所在的列表：从“更多”菜单放进播放队列时的播放来源 */
    source: PlaySource
    /** 序号，从 1 开始 */
    n: number
    /** 正在播放这首 */
    now: boolean
    onplay: () => void
    /** 多选模式：每行前面是勾选框 */
    selecting?: boolean
    selected?: boolean
    /** 不进多选时的 ⌘/Ctrl 点选、Shift 连选 */
    onselect?: (event: MouseEvent) => void
  }

  const { song, source, n, now, onplay, selecting = false, selected = false, onselect }: Props = $props()
  const off = $derived(song.availability === 'noCopyright')
  /** 这一行的封面：点歌时它飞进播放条 */
  let cover = $state<HTMLElement>()

  /** 多选时整行都能点：点在按钮（点歌、红心、•••）上时不重复处理 */
  function rowclick(event: MouseEvent): void {
    if (selecting && !(event.target as Element).closest('button'))
      onplay()
  }
</script>

<div class={['relative h-full rounded-lg', selected ? 'bg-primary-100' : !off && 'mouse:hover:bg-neutral-50']} role='presentation' oncontextmenu={event => openSongMenuAt(event, song, source)} onclick={rowclick}>
  {#if now}<MorningWash start={104} />{/if}
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
      {:else if selected}
        <Check size={16} strokeWidth={2.5} class='text-primary-900' aria-hidden='true' />
      {:else}
        <NowIndex {n} {now} />
      {/if}
    </span>
    <span class={['min-w-0 flex items-center gap-3', SONG_COLUMNS.title]}>
      <span class='flex-none' bind:this={cover}><Cover url={song.album.coverUrl} size={40} class='rounded-md' /></span>
      <PlayTarget class='min-w-0 flex-1' rounded disabled={off && !selecting && !onselect} unplayable={off} {now} {cover} {onplay} {selecting} {selected} {onselect}>
        <span class='min-w-0 flex items-center gap-2'>
          <span class={['truncate text-label font-500 transition-colors duration-state', now ? 'text-primary-950' : 'text-neutral-900']} lang={langOf(song.name)}>{song.name}</span>
          <SongBadge availability={song.availability} />
        </span>
        <span class='block truncate text-caption text-neutral-600' lang={langOf(artistLine(song))}>{artistLine(song)}</span>
      </PlayTarget>
    </span>
    <span class={['truncate text-caption text-neutral-600', SONG_COLUMNS.album]} lang={langOf(song.album.name ?? '')}>{song.album.name}</span>
    <span class={['flex items-center', SONG_COLUMNS.status]}><HeartButton {song} size='row' /></span>
    <span class={['text-caption text-neutral-500 tabular-nums', SONG_COLUMNS.duration]}>{formatDuration(song.duration)}</span>
    <SongMoreButton {song} {source} size='desktop' />
  </div>
</div>

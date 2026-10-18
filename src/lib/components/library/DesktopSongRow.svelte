<!--
  桌面歌曲行（56px，DESIGN.md Song Row）：序号、封面和歌名歌手、专辑、状态（红心键，始终可见）、时长、•••。单击整行就播放；
  ••• 始终可见，右键（键盘的菜单键）打开同一份“更多”菜单。红心键和 ••• 压在整行的点歌按钮上面，点它们不放歌。
  正在播放的那行是晨光行：序号换成三根小竖条，歌名变成森林墨。点歌时这一行的封面飞进播放条（PlayTarget 的 cover）。
  无版权的整行降到 45%、不能点，徽标写明原因（红心键、••• 照样能点）
-->
<script lang='ts'>
  import type { Song } from '#lib/api/library.js'
  import type { PlaySource } from '#lib/api/playback.js'
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
  }

  const { song, source, n, now, onplay }: Props = $props()
  const off = $derived(song.availability === 'noCopyright')
  /** 这一行的封面：点歌时它飞进播放条 */
  let cover = $state<HTMLElement>()
</script>

<div class={['relative h-full rounded-lg', !off && 'mouse:hover:bg-neutral-50']} role='presentation' oncontextmenu={event => openSongMenuAt(event, song, source)}>
  {#if now}<MorningWash start={104} />{/if}
  <div class={['relative grid grid-cols-[36px_minmax(0,1.25fr)_minmax(0,1fr)_112px_48px_40px] h-full items-center gap-4 pl-2 pr-1', off && 'opacity-45']}>
    <NowIndex {n} {now} />
    <span class='min-w-0 flex items-center gap-3'>
      <span class='flex-none' bind:this={cover}><Cover url={song.album.coverUrl} size={40} class='rounded-md' /></span>
      <PlayTarget class='min-w-0 flex-1' rounded disabled={off} {now} {cover} {onplay}>
        <span class='min-w-0 flex items-center gap-2'>
          <span class={['truncate text-label font-500 transition-colors duration-state', now ? 'text-primary-950' : 'text-neutral-900']} lang={langOf(song.name)}>{song.name}</span>
          <SongBadge availability={song.availability} />
        </span>
        <span class='block truncate text-caption text-neutral-600' lang={langOf(artistLine(song))}>{artistLine(song)}</span>
      </PlayTarget>
    </span>
    <span class='truncate text-caption text-neutral-600' lang={langOf(song.album.name ?? '')}>{song.album.name}</span>
    <span class='flex items-center'><HeartButton {song} size='row' /></span>
    <span class='text-right text-caption text-neutral-500 tabular-nums'>{formatDuration(song.duration)}</span>
    <SongMoreButton {song} {source} size='desktop' />
  </div>
</div>

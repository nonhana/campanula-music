<!--
  手机歌曲行（Auxio 式，56px，无分隔线，DESIGN.md Song Row）：封面、歌名、歌手、•••。轻点整行就播放；
  ••• 始终可见，打开“更多”菜单（触屏是底部弹层）；窄窗口里用鼠标时右键打开同一份菜单。
  正在播放的那行是晨光行：封面中间压一枚白色小圆片，里面是三根小竖条，歌名变成森林墨。点歌时这一行的封面飞进播放条（PlayTarget 的 cover）。
  无版权的整行降到 45%、不能点，徽标写明原因（••• 照样能点）
-->
<script lang='ts'>
  import type { Song } from '#lib/api/library.js'
  import type { PlaySource } from '#lib/api/playback.js'
  import MorningWash from '../player/MorningWash.svelte'
  import NowChip from '../player/NowChip.svelte'
  import { openSongMenuAt } from '../song-menu.svelte'
  import Cover from './Cover.svelte'
  import PlayTarget from './PlayTarget.svelte'
  import SongBadge from './SongBadge.svelte'
  import SongMoreButton from './SongMoreButton.svelte'
  import { artistLine, langOf } from './view'

  interface Props {
    song: Song
    /** 这一行所在的列表：从“更多”菜单放进播放队列时的播放来源 */
    source: PlaySource
    /** 正在播放这首 */
    now: boolean
    onplay: () => void
  }

  const { song, source, now, onplay }: Props = $props()
  const off = $derived(song.availability === 'noCopyright')
  /** 这一行的封面：点歌时它飞进播放条 */
  let cover = $state<HTMLElement>()
</script>

<div class='relative h-full' role='presentation' oncontextmenu={event => openSongMenuAt(event, song, source)}>
  {#if now}<MorningWash start={70} onGround />{/if}
  <div class={['relative grid grid-cols-[48px_minmax(0,1fr)_44px] h-full items-center gap-3.5 pl-4 pr-1', off && 'opacity-45']}>
    <span class='relative size-12' bind:this={cover}>
      <Cover url={song.album.coverUrl} size={48} class='rounded-md' />
      {#if now}<NowChip />{/if}
    </span>
    <PlayTarget class='min-w-0' disabled={off} {now} {cover} {onplay}>
      <span class='min-w-0 flex items-center gap-1.5'>
        <span class={['truncate text-body font-500 transition-colors duration-state', now ? 'text-primary-950' : 'text-neutral-900']} lang={langOf(song.name)}>{song.name}</span>
        <SongBadge availability={song.availability} />
      </span>
      <span class='mt-0.5 block truncate text-caption text-neutral-600' lang={langOf(artistLine(song))}>{artistLine(song)}</span>
    </PlayTarget>
    <SongMoreButton {song} {source} size='phone' />
  </div>
</div>

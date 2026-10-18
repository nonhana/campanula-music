<!--
  搜索结果里的一串单曲（综合里的前几首、单曲标签里已经取到的全部）：桌面是带序号的桌面歌曲行，手机是 Auxio 式歌曲行。
  点一首歌是插播（App.play 按播放来源决定）：排在当前这首后面马上放，播放队列其余的不变，播放来源是这次搜索。
  “显示更多”加进来的（从第 appendedAt 首起）依次飘入
-->
<script lang='ts'>
  import type { Song } from '#lib/api/library.js'
  import type { PlaySource } from '#lib/api/playback.js'
  import { getAppView } from '../app-context.svelte'
  import DesktopSongRow from '../library/DesktopSongRow.svelte'
  import PhoneSongRow from '../library/PhoneSongRow.svelte'
  import { stagger } from '../motion'
  import { currentSong } from '../player/view'

  interface Props {
    /** 搜的词 */
    keyword: string
    songs: readonly Song[]
    phone?: boolean
    /** 上一次“显示更多”之前已经有几首 */
    appendedAt?: number
  }

  const { keyword, songs, phone = false, appendedAt = 0 }: Props = $props()
  const view = getAppView()
  /** 在结果里点歌、从“更多”菜单放进播放队列时的播放来源：这次搜索 */
  const source = $derived<PlaySource>({ kind: 'search', keyword })
  const hearts = $derived(view.state.library?.hearts ?? null)
  const nowId = $derived(currentSong(view.state.player)?.id ?? null)
  const play = (song: Song) => () => view.app.play(source, song.id)
</script>

<ul aria-label='单曲' data-reveal-group>
  {#each songs as song, i (song.id)}
    <li class='h-14' in:stagger={{ order: i - appendedAt }}>
      {#if phone}
        <PhoneSongRow {song} {source} now={song.id === nowId} onplay={play(song)} />
      {:else}
        <DesktopSongRow {song} {source} n={i + 1} hearted={hearts?.has(song.id) ?? false} now={song.id === nowId} onplay={play(song)} />
      {/if}
    </li>
  {/each}
</ul>

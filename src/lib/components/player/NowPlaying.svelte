<!--
  正在播放区（桌面底栏、手机迷你条共用）：左边封面小窗，右边歌名、试听标、歌手。
  封面小窗多大由调用方按尺寸给（桌面 48px、手机 44px）：封面按这么大取，列表里点歌时那一行的封面也飞到这里落下（cover-flight.svelte.ts 的 landingOf）；
  换歌时小窗里是一个小转盘（CoverWheel，480ms），歌名、歌手横着飘（SongSwap）。点了或按住往上拖打开播放页（playerPageActions）。
  换了歌先在后台取好播放页那张大封面（prefetchPageCover），拉开播放页时直接是大图。
  两个播放条只差尺寸、按钮的悬停/按下样式和歌名与试听标之间的空隙，所以只把这几样当参数
-->
<script lang='ts'>
  import { getAppView } from '../app-context.svelte'
  import { landingOf } from '../cover-flight.svelte'
  import { fade } from '../motion'
  import { DURATIONS } from '../motion-tokens'
  import { currentSong } from '../now'
  import SongBadge from '../songs/SongBadge.svelte'
  import { artistLine, langOf } from '../text'
  import CoverWheel from './CoverWheel.svelte'
  import { playerPageActions, prefetchPageCover } from './player-page.svelte'
  import SongSwap from './SongSwap.svelte'

  interface Props {
    /** 封面小窗多大（px）：封面按这么大取，飞来的封面也按这么大落下 */
    size: number
    /** 播放页的大封面按多大取（PAGE_COVER） */
    pageCover: number
    /** 按钮本身的排版：两个播放条只差悬停 / 按下的样子 */
    buttonClass?: string
    /** 歌名和试听标之间空多少：两个播放条只差这一处 */
    nameClass?: string
  }

  const { size, pageCover, buttonClass = '', nameClass = 'gap-2' }: Props = $props()
  const view = getAppView()
  const { gripToOpenPlayerPage } = playerPageActions()
  const player = $derived(view.state.player)
  /** 当前这首：按钮的名字跟着它，不等封面飞完 */
  const song = $derived(currentSong(player))
  /** 封面小窗和歌名显示的那首、怎么换上来的 */
  const landing = landingOf(view, () => size)
  prefetchPageCover(() => song, () => pageCover)
  const gripSong = gripToOpenPlayerPage()
</script>

{#if song}
  <button type='button' class={['min-w-0 flex flex-1 items-center gap-3 rounded-lg text-left', buttonClass]} aria-label='打开播放页：{song.name}' {@attach gripSong}>
    <span class='flex-none overflow-hidden rounded-md' style:width='{size}px' style:height='{size}px' {@attach landing.slot}>
      {#if landing.song}
        <CoverWheel song={landing.song} turn={landing.turn} duration={DURATIONS['focal-bar']} size={size} eager class='rounded-md' />
      {/if}
    </span>
    <SongSwap song={landing.song} turn={landing.turn} place='bar'>
      {#snippet children(shown)}
        <span class={['min-w-0 flex items-center', nameClass]}>
          <span class='truncate text-label text-neutral-900 font-500' lang={langOf(shown.name)}>{shown.name}</span>
          {#if player.trial}<span class='flex flex-none' transition:fade><SongBadge kind='trial' /></span>{/if}
        </span>
        <span class='block truncate text-caption text-neutral-600' lang={langOf(artistLine(shown))}>{artistLine(shown)}</span>
      {/snippet}
    </SongSwap>
  </button>
{/if}

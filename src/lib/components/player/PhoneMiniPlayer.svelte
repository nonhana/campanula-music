<!--
  手机迷你播放条（64px，DESIGN.md Player Bars）：封面、歌名、歌手，44px 圆形播放键、下一首，底边一条很细的进度线。
  轻点封面和歌名那一块打开播放页，按住往上拖也能拉开。换歌时封面小窗里是一个小转盘（CoverWheel，480ms），歌名、歌手横着飘（SongSwap）；
  在列表里点歌时那一行的封面飞进小窗，落下时才换上新的歌名（cover-flight.svelte.ts）。拉开、收起播放页时小窗里的封面长成播放页的大封面
  （CoverRelay），换了歌就先在后台取好那张大图。放在 PhoneShell 的 bar 里
-->
<script lang='ts'>
  import { SkipForward } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import SongBadge from '../library/SongBadge.svelte'
  import { artistLine, langOf } from '../library/view'
  import { DURATIONS } from '../motion-tokens'
  import IconButton from '../ui/IconButton.svelte'
  import { landingOf } from './cover-flight.svelte'
  import { coverRelaying, prefetchPageCover } from './CoverRelay.svelte'
  import CoverWheel from './CoverWheel.svelte'
  import PlayButton from './PlayButton.svelte'
  import { gripToOpenPlayerPage } from './player-page.svelte'
  import ProgressLine from './ProgressLine.svelte'
  import SongSwap from './SongSwap.svelte'
  import { currentSong, PAGE_COVER } from './view'

  const view = getAppView()
  const player = $derived(view.state.player)
  /** 当前这首：按钮的名字跟着它，不等封面飞完 */
  const song = $derived(currentSong(player))
  /** 封面小窗多大（px）：封面按这么大取，飞来的封面也按这么大落下 */
  const COVER_SIZE = 44
  /** 封面小窗和歌名显示的那首、怎么换上来的 */
  const landing = landingOf(view, COVER_SIZE)
  prefetchPageCover(() => song, PAGE_COVER.phone)
  const gripSong = gripToOpenPlayerPage()
</script>

<div class='h-full flex items-center gap-1 pl-2 pr-1.5'>
  {#if song}
    <button type='button' class='h-full min-w-0 flex flex-1 items-center gap-3 rounded-lg text-left active:bg-neutral-50' aria-label='打开播放页：{song.name}' {@attach gripSong}>
      <!-- 拉开、收起播放页时这里藏着，封面跟着抽屉长成播放页的大封面（CoverRelay） -->
      <span class='size-11 flex-none overflow-hidden rounded-md' style:opacity={coverRelaying() ? 0 : undefined} {@attach landing.slot}>
        {#if landing.song}
          <CoverWheel song={landing.song} turn={landing.turn} duration={DURATIONS['focal-bar']} size={COVER_SIZE} eager class='rounded-md' />
        {/if}
      </span>
      <SongSwap song={landing.song} turn={landing.turn} place='bar'>
        {#snippet children(shown)}
          <span class='min-w-0 flex items-center gap-1.5'>
            <span class='truncate text-label text-neutral-900 font-500' lang={langOf(shown.name)}>{shown.name}</span>
            {#if player.trial}<SongBadge availability='trial' />{/if}
          </span>
          <span class='block truncate text-caption text-neutral-600' lang={langOf(artistLine(shown))}>{artistLine(shown)}</span>
        {/snippet}
      </SongSwap>
    </button>
  {/if}
  <PlayButton />
  <IconButton icon={SkipForward} filled label='下一首' onclick={() => view.app.next()} />
</div>
<ProgressLine />

<!--
  桌面底部通栏（80px，DESIGN.md Player Bars）：左边上一首 / 播放 / 下一首和时间，中间封面和歌名（点开播放页，按住往上拖也能拉开），右边音量；
  顶边一条 2px 的薄荷进度线，也是滑块：点按、拖动跳到那里，拖动时左边的时间跟着走（SeekLine）。
  换歌时封面小窗里是一个小转盘（CoverWheel，480ms），歌名、歌手横着飘（SongSwap）。
  播放模式和播放队列（#26）由之后的票加。放在 DesktopShell 的 bar 里
-->
<script lang='ts'>
  import { SkipBack, SkipForward } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import SongBadge from '../library/SongBadge.svelte'
  import { artistLine, langOf } from '../library/view'
  import { DURATIONS } from '../motion-tokens'
  import IconButton from '../ui/IconButton.svelte'
  import CoverWheel from './CoverWheel.svelte'
  import PlayButton from './PlayButton.svelte'
  import { gripToOpenPlayerPage } from './player-page.svelte'
  import { createSeekSlider } from './seek-slider.svelte'
  import SeekLine from './SeekLine.svelte'
  import SongSwap from './SongSwap.svelte'
  import { currentSong, formatSeconds, turnOf } from './view'
  import VolumeControl from './VolumeControl.svelte'

  const view = getAppView()
  const player = $derived(view.state.player)
  const song = $derived(currentSong(player))
  const turn = $derived(turnOf(player.change, 'bar'))
  const gripSong = gripToOpenPlayerPage()
  const slider = createSeekSlider()
  /** 左边的时间：拖动进度线时显示拖到哪 */
  const shownTime = $derived(slider.dragging === null ? player.position : slider.dragging * slider.duration)
</script>

<SeekLine {slider} />

<!-- 两边的按键、时间不缩，窄窗口（768）里中间的歌名让位 -->
<div class='grid grid-cols-[minmax(max-content,1fr)_minmax(0,440px)_minmax(max-content,1fr)] h-full items-center gap-6'>
  <div class='flex items-center gap-1.5'>
    <IconButton icon={SkipBack} filled label='上一首' onclick={() => view.app.previous()} />
    <PlayButton />
    <IconButton icon={SkipForward} filled label='下一首' onclick={() => view.app.next()} />
    <span class='ml-3 whitespace-nowrap text-caption text-neutral-600 tabular-nums'>
      {formatSeconds(shownTime)} / {formatSeconds(slider.duration)}
    </span>
  </div>

  {#if song}
    <button type='button' class='min-w-0 flex items-center gap-3 rounded-lg py-1 pr-2 text-left transition-colors duration-feedback mouse:hover:bg-primary-50' aria-label='打开播放页：{song.name}' title='点按或往上拖，打开播放页' {@attach gripSong}>
      <span class='size-12 flex-none overflow-hidden rounded-md'>
        <CoverWheel {song} {turn} duration={DURATIONS['focal-bar']} size={48} class='rounded-md' />
      </span>
      <SongSwap {song} {turn} place='bar'>
        {#snippet children(shown)}
          <span class='min-w-0 flex items-center gap-2'>
            <span class='truncate text-label text-neutral-900 font-500' lang={langOf(shown.name)}>{shown.name}</span>
            {#if player.trial}<SongBadge availability='trial' />{/if}
          </span>
          <span class='block truncate text-caption text-neutral-600' lang={langOf(artistLine(shown))}>{artistLine(shown)}</span>
        {/snippet}
      </SongSwap>
    </button>
  {/if}

  <div class='flex items-center justify-end gap-1.5'>
    <VolumeControl class='w-24' />
  </div>
</div>

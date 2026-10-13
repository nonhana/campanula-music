<!--
  桌面底部通栏（80px，DESIGN.md Player Bars）：左边上一首 / 播放 / 下一首和时间，中间封面和歌名，右边音量；
  顶边一条 2px 的薄荷进度线。点开播放页（#25）、播放模式和播放队列（#26）由之后的票加。放在 DesktopShell 的 bar 里
-->
<script lang='ts'>
  import { SkipBack, SkipForward, Volume1, Volume2, VolumeX } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import Cover from '../library/Cover.svelte'
  import SongBadge from '../library/SongBadge.svelte'
  import { artistLine, langOf } from '../library/view'
  import IconButton from '../ui/IconButton.svelte'
  import PlayButton from './PlayButton.svelte'
  import PlayerNotice from './PlayerNotice.svelte'
  import ProgressLine from './ProgressLine.svelte'
  import { currentSong, formatSeconds, shownDuration } from './view'
  import VolumeSlider from './VolumeSlider.svelte'

  const view = getAppView()
  const player = $derived(view.state.player)
  const song = $derived(currentSong(player))
  /** 静音前的音量：取消静音时回到它 */
  let unmuted = 1

  function toggleMute() {
    if (player.volume > 0) {
      unmuted = player.volume
      view.app.setVolume(0)
    }
    else {
      view.app.setVolume(unmuted)
    }
  }
</script>

<ProgressLine edge='top' />

<!-- 两边的按键、时间不缩，窄窗口（768）里中间的歌名让位 -->
<div class='grid grid-cols-[minmax(max-content,1fr)_minmax(0,440px)_minmax(max-content,1fr)] h-full items-center gap-6'>
  <div class='flex items-center gap-1.5'>
    <IconButton icon={SkipBack} filled label='上一首' onclick={() => view.app.previous()} />
    <PlayButton />
    <IconButton icon={SkipForward} filled label='下一首' onclick={() => view.app.next()} />
    <span class='ml-3 whitespace-nowrap text-caption text-neutral-600 tabular-nums'>
      {formatSeconds(player.position)} / {formatSeconds(shownDuration(player))}
    </span>
  </div>

  {#if song}
    <div class='min-w-0 flex items-center gap-3'>
      <Cover url={song.album.coverUrl} size={48} class='rounded-md' />
      <span class='min-w-0'>
        <span class='min-w-0 flex items-center gap-2'>
          <span class='truncate text-label text-neutral-900 font-500' lang={langOf(song.name)}>{song.name}</span>
          {#if player.trial}<SongBadge availability='trial' />{/if}
        </span>
        <span class='block truncate text-caption text-neutral-600' lang={langOf(artistLine(song))}>{artistLine(song)}</span>
      </span>
    </div>
  {/if}

  <div class='flex items-center justify-end gap-1.5'>
    <IconButton icon={player.volume === 0 ? VolumeX : player.volume < 0.5 ? Volume1 : Volume2} label={player.volume === 0 ? '取消静音' : '静音'} onclick={toggleMute} />
    <VolumeSlider class='w-24' />
  </div>
</div>

<PlayerNotice />

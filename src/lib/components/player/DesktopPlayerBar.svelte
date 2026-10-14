<!--
  桌面底部通栏（80px，DESIGN.md Player Bars）：左边上一首 / 播放 / 下一首和时间，中间封面和歌名（点开播放页，按住往上拖也能拉开），右边音量；
  顶边一条 2px 的薄荷进度线。播放模式和播放队列（#26）由之后的票加。放在 DesktopShell 的 bar 里
-->
<script lang='ts'>
  import { SkipBack, SkipForward } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import Cover from '../library/Cover.svelte'
  import SongBadge from '../library/SongBadge.svelte'
  import { artistLine, langOf } from '../library/view'
  import IconButton from '../ui/IconButton.svelte'
  import PlayButton from './PlayButton.svelte'
  import { grabToOpenPlayerPage } from './player-page.svelte'
  import ProgressLine from './ProgressLine.svelte'
  import { currentSong, formatSeconds, shownDuration } from './view'
  import VolumeControl from './VolumeControl.svelte'

  const view = getAppView()
  const player = $derived(view.state.player)
  const song = $derived(currentSong(player))
  const grabSong = grabToOpenPlayerPage()
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
    <button type='button' class='min-w-0 flex touch-none items-center gap-3 rounded-lg py-1 pr-2 text-left transition-colors duration-150 mouse:hover:bg-primary-50' aria-label='打开播放页：{song.name}' title='点按或往上拖，打开播放页' {...grabSong}>
      <Cover url={song.album.coverUrl} size={48} class='rounded-md' />
      <span class='min-w-0'>
        <span class='min-w-0 flex items-center gap-2'>
          <span class='truncate text-label text-neutral-900 font-500' lang={langOf(song.name)}>{song.name}</span>
          {#if player.trial}<SongBadge availability='trial' />{/if}
        </span>
        <span class='block truncate text-caption text-neutral-600' lang={langOf(artistLine(song))}>{artistLine(song)}</span>
      </span>
    </button>
  {/if}

  <div class='flex items-center justify-end gap-1.5'>
    <VolumeControl class='w-24' />
  </div>
</div>

<!--
  手机迷你播放条（64px，DESIGN.md Player Bars）：红心键、44px 圆形播放键、下一首，底边一条很细的进度线。
  封面小窗、歌名 / 试听标 / 歌手、换碟、列表点歌的落点和播放页大图预取都在 NowPlaying（两个播放条共用）。
  轻点封面和歌名那一块打开播放页，按住往上拖也能拉开；放在 PlayerDock 的手机迷你条里（三个外框共用这一层停靠）
-->
<script lang='ts'>
  import { SkipForward } from '@lucide/svelte'

  import { getAppView } from '../shared/app-context.svelte'
  import HeartButton from '../songs/HeartButton.svelte'
  import IconButton from '../ui/IconButton.svelte'
  import { currentSong } from './now'
  import NowPlaying from './NowPlaying.svelte'
  import PlayButton from './PlayButton.svelte'
  import ProgressLine from './ProgressLine.svelte'
  import { PAGE_COVER } from './view'

  const view = getAppView()
  const player = $derived(view.state.player)
  /** 当前这首：红心键跟着它 */
  const song = $derived(currentSong(player))
</script>

<div class='h-full flex items-center gap-1 pl-2 pr-1.5'>
  {#if song}
    <NowPlaying
      size={44}
      pageCover={PAGE_COVER.phone}
      buttonClass='h-full active:bg-neutral-50'
      nameClass='gap-1.5'
    />
    <HeartButton {song} size='phone' />
  {/if}
  <PlayButton />
  <IconButton icon={SkipForward} filled label='下一首' onclick={() => view.app.next()} />
</div>
<ProgressLine />

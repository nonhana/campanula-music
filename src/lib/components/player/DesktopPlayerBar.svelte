<!--
  桌面底部通栏（80px，DESIGN.md Player Bars）：左边上一首 / 播放 / 下一首和时间，中间封面和歌名（点开播放页，按住往上拖也能拉开；播放队列面板开着时先收起它）、
  靠这一栏右边的红心键（不在打开播放页的按钮里），
  右边播放模式（按一下换一种）、音量、播放队列（开关桌面播放队列面板 QueuePanel，不拉开播放页、不改播放页记着的标签；开着时薄荷玻璃底、森林墨图标，和侧栏当前项一样）；
  顶边一条 2px 的薄荷进度线，也是滑块：点按、拖动跳到那里，拖动时左边的时间跟着走（SeekLine）。
  封面小窗、歌名 / 试听标 / 歌手、换碟、列表点歌的落点和播放页大图预取都在 NowPlaying（两个播放条共用）。
  放在 PlayerDock 的桌面底栏里（三个外框共用这一层停靠）
-->
<script lang='ts'>
  import { ListMusic, SkipBack, SkipForward } from '@lucide/svelte'

  import { getOverlays } from '../overlay/overlay-context'
  import { getAppView } from '../shared/app-context.svelte'
  import HeartButton from '../songs/HeartButton.svelte'
  import IconButton from '../ui/IconButton.svelte'
  import { currentSong } from './now'
  import NowPlaying from './NowPlaying.svelte'
  import PlayButton from './PlayButton.svelte'
  import PlayModeButton from './PlayModeButton.svelte'
  import { QUEUE_PANEL_ID } from './QueuePanel.svelte'
  import { createSeekSlider } from './seek-slider.svelte'
  import SeekLine from './SeekLine.svelte'
  import { formatSeconds, PAGE_COVER } from './view'
  import VolumeControl from './VolumeControl.svelte'

  const view = getAppView()
  const { queuePanel } = getOverlays()
  const panelOpen = $derived(queuePanel.request !== null)
  const player = $derived(view.state.player)
  const song = $derived(currentSong(player))
  const slider = createSeekSlider()
  /** 拖动进度线时显示拖到哪 */
  const shownTime = $derived(slider.dragging === null
    ? player.position
    : slider.dragging * slider.duration)
</script>

<SeekLine {slider} />

<!-- 两边按键、时间不缩；窄窗口（768）里中间歌名让位，红心键不让 -->
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
    <div class='min-w-0 flex items-center gap-1'>
      <NowPlaying
        size={48}
        pageCover={PAGE_COVER.desktop}
        buttonClass='py-1 pr-2 transition-colors duration-feedback mouse:hover:bg-primary-50'
      />
      <HeartButton {song} size='desktop' />
    </div>
  {/if}

  <div class='flex items-center justify-end gap-1.5'>
    <PlayModeButton kind='cycle' />
    <VolumeControl class='w-24' />
    <IconButton
      icon={ListMusic}
      label='播放队列'
      class={['ml-2', panelOpen && 'bg-primary-200! text-primary-950!']}
      aria-expanded={panelOpen}
      aria-controls={panelOpen ? QUEUE_PANEL_ID : undefined}
      data-queue-toggle
      onclick={(event) => {
        if (panelOpen)
          void queuePanel.close()
        else
          void queuePanel.open({ from: event.currentTarget })
      }}
    />
  </div>
</div>

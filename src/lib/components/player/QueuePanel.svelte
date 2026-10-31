<!--
  桌面播放队列面板（DESIGN.md Overlays · 播放队列面板）：播放条的“播放队列”按钮开关它，浮在内容上、不拉开播放页。
  右边 16px、上沿和下载面板一样（顶栏下 16px，断网时让开提示条）、下沿离播放条 16px，宽 400px；纸白、16px 圆角、浮起阴影，盖在下载面板上面。
  浮层栈里的 queue-panel 层：不是 modal（不压暗、背景照常能点）、不进浏览记录；Esc、换页由栈收起，焦点还给队列按钮。
  点面板和播放条以外的地方收起，焦点留在点到的地方；播放条上的按键照常用、不收起。窗口变成手机布局、播放队列被清空也收起。
  打开时从右边飘进来（和下载面板同一种），焦点落在正在播放的那一行；里面点歌就放、面板不收起，不飞封面（播放条照常换碟）。
-->
<script module lang='ts'>
  /** 队列按钮的 aria-controls */
  export const QUEUE_PANEL_ID = 'queue-panel'
</script>

<script lang='ts'>
  import { getOverlays } from '../overlay/overlay-context'
  import { getAppView } from '../shared/app-context.svelte'
  import { desktopLayout, desktopPanelTop } from '../shared/layout'
  import { float } from '../shared/motion'
  import { focusNowRow } from '../shared/now-locate.svelte'
  import QueueList from './QueueList.svelte'
  import { queueEmpty } from './view'

  const view = getAppView()
  const { queuePanel: layer } = getOverlays()
  const request = $derived(layer.request)
  const top = $derived(desktopPanelTop(view.state.online))

  let panel = $state<HTMLElement>()

  $effect(() => {
    if (request && (!desktopLayout.current || queueEmpty(view.state.player)))
      void layer.close()
  })

  $effect(() => {
    if (!request)
      return
    const shown = request
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element
      if (layer.request === shown && !panel?.contains(target) && !target.closest('[data-player-bar]'))
        void layer.close(false)
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  })

  // 等播放队列把当前这首放好位置、虚拟列表画出那一行（下一帧之前的滚动事件里）再给焦点
  $effect(() => {
    if (!request || !panel)
      return
    const root = panel
    const frame = requestAnimationFrame(() => focusNowRow(root))
    return () => cancelAnimationFrame(frame)
  })
</script>

{#if request}
  <div
    bind:this={panel}
    id={QUEUE_PANEL_ID}
    class='fixed bottom-24 right-4 z-40 w-[400px] flex flex-col overflow-hidden rounded-xl bg-white shadow-float'
    style:top='{top}px'
    inert={layer.inert}
    in:float={{ toward: 'left', distance: 24, panel: true }}
    out:float={{ toward: 'right', distance: 24, panel: true }}
  >
    <QueueList titled class='min-h-0 flex-1' />
  </div>
{/if}

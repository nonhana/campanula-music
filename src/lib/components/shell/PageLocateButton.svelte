<!--
  页面级的“定位到正在播放”（三个外框共用，DESIGN.md Layout · 滚动）：固定在视口里。桌面离播放条上沿 16px、离窗口右边 24px（让开滚动条贴边的悬停带），
  下载面板展开时挪到它左边（16 + 360 + 16px），桌面播放队列面板开着时不出现；手机离迷你播放条上沿 12px、离右边 16px，下载面板收成横条时抬高让开它（和提示条一样）。
  z 序和下载面板同一档，DOM 里排在它前面：盖住手机播放条的晨光渐隐，被下载面板、桌面播放队列面板、提示条盖住。
  挂在外框这一层，不放进会做 transform 的祖先（in:reveal 的飘入、抽屉），固定定位才不跟着跑。
-->
<script lang='ts'>
  import { getOverlays } from '../overlay/overlay-context'
  import type { NowLocate } from '../shared/now-locate.svelte'
  import LocateNowButton from '../songs/LocateNowButton.svelte'

  const { locate, desktop }: { locate: NowLocate, desktop: boolean } = $props()
  const { downloadPanel, queuePanel } = getOverlays()
  /** 手机上下载面板收成 48px 横条 */
  const lifted = $derived(!desktop && downloadPanel.open && downloadPanel.collapsed && !downloadPanel.onDownloads)
</script>

<LocateNowButton
  {locate}
  hidden={desktop && queuePanel.request !== null}
  class={[
    'fixed z-30',
    desktop
      ? [
        'bottom-24',
        downloadPanel.expanded ? 'right-[392px]' : 'right-6',
      ]
      : [
        'right-4',
        lifted ? 'bottom-[calc(140px+env(safe-area-inset-bottom))]' : 'bottom-[calc(84px+env(safe-area-inset-bottom))]',
      ],
  ]}
/>

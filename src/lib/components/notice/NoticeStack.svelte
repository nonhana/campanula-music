<!--
  提示条的一摞（改曲库、下载、播放提示共用，#30、#33、#38）：最多 3 条操作提示，播放提示排在最后、离播放条最近。
  桌面底部正中；手机迷你播放条上方，播放页开着时到顶上。位置、错开和换位置的交叉淡化都在这里算，每条只管自己的样子。
  换页时原地不动（view-transition-class still）；刚出现从贴着的边飘进来，走时淡出。
-->
<script lang='ts'>
  import { getOverlays } from '../overlay/overlay-context'
  import PlayerNotice from '../player/PlayerNotice.svelte'
  import { getAppView } from '../shared/app-context.svelte'
  import { desktopLayout } from '../shared/layout'
  import OperationNotice from './OperationNotice.svelte'

  type Place = 'desktop' | 'top' | 'bottom'

  const view = getAppView()
  const overlays = getOverlays()
  const panel = $derived(overlays.downloadPanel)
  const operations = $derived(view.state.notices)
  const playerNotice = $derived(view.state.player.notice)
  /** 桌面底部正中；手机迷你播放条上方，播放页开着或下载面板展开时到顶上 */
  const place = $derived<Place>(desktopLayout.current
    ? 'desktop'
    : overlays.playerLayer.open || panel.expanded
    ? 'top'
    : 'bottom')
  const edge = $derived<'top' | 'bottom'>(place === 'top'
    ? 'top'
    : 'bottom')
  const phone = $derived(place !== 'desktop')
  /** 手机上面板收起了：提示条让开那条 48px 的横条 */
  const lifted = $derived(!desktopLayout.current && panel.open && panel.collapsed && !panel.onDownloads)

  /** 换位置时只交叉淡化，从边上进来的另有飘入（DESIGN.md Overlays 的提示条） */
  const arrival = { moved: false }
  let lastPlace: Place | null = null
  $effect.pre(() => {
    const now = operations.length > 0 || playerNotice
      ? place
      : null
    arrival.moved = lastPlace !== null && now !== null && now !== lastPlace
    lastPlace = now
  })
</script>

{#if operations.length > 0 || playerNotice}
  <!-- 换了位置是另一块：旧位置上的淡出，新位置上的淡入 -->
  {#key place}
    <div
      class={[
        'pointer-events-none fixed z-50 flex gap-2',
        place === 'desktop'
          ? 'bottom-24 left-1/2 max-w-[calc(100vw-48px)] flex-col items-center'
          : place === 'top'
          ? 'inset-x-2 top-16 flex-col-reverse'
          : lifted
          ? 'inset-x-2 bottom-[calc(136px+env(safe-area-inset-bottom))] flex-col'
          : 'inset-x-2 bottom-[calc(80px+env(safe-area-inset-bottom))] flex-col',
      ]}
      style:transform={place === 'desktop'
        ? panel.expanded
          ? 'translateX(calc(-50% - 180px))'
          : 'translateX(-50%)'
        : undefined}
    >
      {#each operations as entry (entry.id)}
        <OperationNotice {entry} {phone} {edge} moved={arrival.moved} />
      {/each}
      {#if playerNotice}
        <PlayerNotice {playerNotice} {phone} {edge} moved={arrival.moved} />
      {/if}
    </div>
  {/key}
{/if}

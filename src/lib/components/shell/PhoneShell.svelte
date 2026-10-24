<!--
  手机骨架（窄于 768px，DESIGN.md Layout）：顶上一行（logo、搜索、每日推荐；二级页面是返回栏），
  下面可以跟文字标签（我喜欢 / 歌单 / 专辑 / 歌手），然后是内容；底部是离屏幕边 8px 浮起的迷你播放条，
  下面垫一层晨光底的渐隐。只管区域和尺寸；顶行、标签行里放什么由调用方传进来。
  页面的滚动条贴着窗口右边，从顶行（连着标签）下沿到迷你播放条上沿；顶行下面留出 scroll-padding-top（DESIGN.md Layout · 滚动）。
  页面里的歌曲列表从上下文拿 ScrollLookup，按住滚动条拖时气泡写它最上面那首。
  换页时（uno.config.ts）：顶行（logo 行 ↔ 返回栏）、标签行交叉淡化，迷你播放条和它下面的渐隐原地不动，只有内容在动
  播放条由 PlayerDock 停靠（三个外框共用）：第一次有歌时从屏幕底下浮上来、渐隐跟着淡入，清空（包括退出登录，整个骨架拿掉时）沉下去
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import { onDestroy } from 'svelte'
  import { getOverlays } from '../overlay/overlay-context'
  import { setScrollLookup } from '../shared/scroll-marks'
  import Scrollbar from '../ui/Scrollbar.svelte'
  import { playerDockBottom } from './player-dock'
  import PlayerDock from './PlayerDock.svelte'
  import { pageScrollPadding } from './scroll-padding'

  interface Props {
    /** 56px 高的顶行 */
    header: Snippet
    /** 跟着顶行吸在页面顶上的文字标签 */
    tabs?: Snippet
    /** 占播放条位置的操作条（手机多选）；不传就是播放条本身 */
    replace?: Snippet
    /** 设计系统页（/design）画骨架示意图用：播放条区域里的替身；生产外框不传 */
    preview?: Snippet
    children: Snippet
  }

  const { header, tabs, replace, preview, children }: Props = $props()
  const lookup = setScrollLookup({ markAt: null })
  const { playerLayer } = getOverlays()
  /** 底下有没有东西：播放条、占它位置的多选操作条，或设计页的示意图 */
  const docked = $derived(preview !== undefined || replace !== undefined || playerLayer.hasQueue)
  const scrollPadding = pageScrollPadding()

  /** 吸在顶上的那一块（顶行，曲库里连着文字标签）有多高 */
  let top = $state(0)

  // Tab 到、定位到的东西不藏在顶行底下，焦点环也露得出来；顶行变高（曲库里连着文字标签）时跟着变
  $effect(() => scrollPadding.set(`${top + 8}px`))
  onDestroy(scrollPadding.release)
</script>

<div class={['min-h-dvh bg-primary-50', docked ? 'pb-[calc(96px+env(safe-area-inset-bottom))]' : 'pb-[calc(32px+env(safe-area-inset-bottom))]']}>
  <!-- 顶行、标签行自己也铺上底色：换页时它们单独成块，不透明才盖得住下面飘动的内容 -->
  <div class='sticky top-0 z-20 bg-primary-50' bind:clientHeight={top} data-page-top>
    <header class='h-14 flex items-center gap-1 bg-primary-50 pl-4 pr-2' style:view-transition-name='phone-top' style:view-transition-class='crossfade'>
      {@render header()}
    </header>
    {#if tabs}
      <div class='bg-primary-50' style:view-transition-name='phone-tabs' style:view-transition-class='crossfade'>{@render tabs()}</div>
    {/if}
  </div>
  <main>
    {@render children()}
  </main>
  <PlayerDock present={docked} {replace} {preview} />
  <Scrollbar page={{ top: `${top}px`, bottom: playerDockBottom({ desktop: false, present: docked, withoutBar: 'env(safe-area-inset-bottom)' }) }} {lookup} />
</div>

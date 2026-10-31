<!--
  桌面骨架（768px 及以上，DESIGN.md Layout）：晨光底上 64px 顶栏、72px 图标侧栏（展开 220px，内容区跟着让位）、内容区（最大宽 1280px）、80px 底部通栏；只管区域和尺寸，里面放什么由调用方传。
  页面的滚动条贴着窗口右边，从顶栏下沿到底栏上沿，顶栏下面留出 scroll-padding-top（DESIGN.md Layout · 滚动）；歌曲列表从上下文拿 ScrollLookup，按住滚动条拖时气泡写它最上面那首。
  歌曲列表也从上下文拿“定位到正在播放”（shared/now-locate）：正在放的那一行不在顶栏（连着吸在顶栏下的标签）和播放条之间时，右下角画定位按钮（PageLocateButton）。
  换页时只有内容区在动：顶栏、侧栏、底栏各自起了名字，过渡里原地不动（view-transition-class still，见 uno.config.ts）；侧栏收起时先等文字淡出（SignedInFrame），再变窄。
  断网时顶栏下面多一条提示条（#42），内容区和侧栏一起让出它那 36px。
  播放条由 PlayerDock 停靠：第一次有歌时从屏幕底下浮上来，清空（包括退出登录，整个骨架拿掉时）沉下去；侧栏最下面的设置跟着它上下（只动 transform），不跳。
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import { onDestroy } from 'svelte'

  import OfflineBar, { OFFLINE_BAR_HEIGHT } from '../notice/OfflineBar.svelte'
  import { getOverlays } from '../overlay/overlay-context'
  import { createNowLocate, setNowLocate } from '../shared/now-locate.svelte'
  import { setScrollLookup } from '../shared/scroll-marks'
  import Scrollbar from '../ui/Scrollbar.svelte'
  import PageLocateButton from './PageLocateButton.svelte'
  import { playerDockBottom, playerDockTop } from './player-dock'
  import PlayerDock from './PlayerDock.svelte'
  import { pageScrollPadding, stickyBelowHeader } from './scroll-padding'

  interface Props {
    railExpanded: boolean
    /** 断网：顶栏下面贴一条提示，内容区和侧栏都往下让 */
    offline?: boolean
    /** 顶栏：菜单键、logo、返回、正中的搜索框、头像 */
    header: Snippet
    /** 图标侧栏上面的：曲库、每日推荐、已下载 */
    rail: Snippet
    /** 图标侧栏最下面的：设置 */
    railEnd?: Snippet
    /** 设计系统页（/design）画骨架示意图用：播放条区域里的替身；生产外框不传 */
    preview?: Snippet
    children: Snippet
  }

  const { railExpanded, offline = false, header, rail, railEnd, preview, children }: Props = $props()
  const lookup = setScrollLookup({ markAt: null })
  const { playerLayer } = getOverlays()
  /** 播放条在不在：内容区、侧栏最下面那一项都给 80px 通栏让位（设计页的示意图也算） */
  const docked = $derived(preview !== undefined || playerLayer.hasQueue)
  const scrollPadding = pageScrollPadding()
  /** 顶栏 64px；断网提示条再占它自己的高度 */
  const top = $derived(64 + (offline
    ? OFFLINE_BAR_HEIGHT
    : 0))
  const nowLocate = setNowLocate(createNowLocate({
    scroller: () => null,
    band: () => ({
      top: top + stickyBelowHeader(),
      bottom: playerDockTop(),
    }),
  }))

  // Tab 到、定位到的东西不藏在顶栏底下，焦点环也露得出来。页面里吸在顶栏下面的一行（搜索结果的标签）把自己的高度写在
  // --sticky-below-header 上，一起让出来
  $effect(() => scrollPadding.set(`calc(${top + 8}px + var(--sticky-below-header, 0px))`))
  onDestroy(scrollPadding.release)
</script>

<div
  class='bg-primary-50 min-h-dvh'
  style:--rail-width={railExpanded ? '220px' : '72px'}
  style:--offline-bar-height={offline
    ? `${OFFLINE_BAR_HEIGHT}px`
    : '0px'}
>
  <header class='fixed inset-x-0 top-0 z-40 h-16 flex items-center gap-3 bg-primary-50 pl-4 pr-6' style:view-transition-name='shell-header' style:view-transition-class='still' data-page-top>
    {@render header()}
  </header>
  {#if offline}
    <div class='fixed inset-x-0 top-16 z-30'>
      <OfflineBar />
    </div>
  {/if}
  <!-- 侧栏一直通到窗口底，播放条盖在它上面 -->
  <nav
    class={['fixed bottom-0 left-0 z-30 w-[var(--rail-width)] flex flex-col overflow-hidden px-3 pb-4 pt-2 transition-[width] duration-move-state', !railExpanded && 'delay-state-out']}
    style:top={`${top}px`}
    style:view-transition-name='shell-rail'
    style:view-transition-class='still'
    aria-label='主导航'
  >
    {@render rail()}
    <!-- 最下面的让出播放条的位置：播放条浮上来时一起上去（360ms），沉下去时一起下来（200ms），不跳 -->
    {#if railEnd}
      <div class={[
        'mt-auto transition-transform',
        docked ? 'duration-move-panel -translate-y-20' : 'duration-move-panel-out ease-in-soft',
      ]}>
        {@render railEnd()}
      </div>
    {/if}
  </nav>
  <main class={[
    'transition-[padding] duration-move-state',
    docked ? 'pb-28' : 'pb-12',
  ]} style:padding-top={`${top}px`}>
    <!-- 跟着侧栏让位：和侧栏一样，收起时等文字淡出再变 -->
    <div class={['pl-[var(--rail-width)] transition-[padding] duration-move-state', !railExpanded && 'delay-state-out']}>
      <div class='mx-auto max-w-[1280px] px-8 pt-4'>
        {@render children()}
      </div>
    </div>
  </main>
  <PlayerDock present={docked} {preview} />
  <PageLocateButton locate={nowLocate} desktop />
  <Scrollbar page={{
    top: `${top}px`,
    bottom: playerDockBottom({ desktop: true, present: docked, withoutBar: '0px' }),
  }} {lookup} />
</div>

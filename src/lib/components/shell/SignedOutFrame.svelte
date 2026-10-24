<!--
  没登录、登录失效时的已下载页外框（#38，原型 DesktopLoggedOut / PhoneLoggedOut 的已下载那一屏）：ADR-0006 说下载属于设备，这是“未登录只能看到登录页”的唯一例外。
  顶上一行是 logo（回到登录页）和右边的“登录”，没有侧栏、顶栏搜索；播放队列里有歌时底下是播放条（桌面 80px 通栏、手机浮起的迷你播放条），能打开播放页、能开“更多”菜单。
  播放页、播放提示、“更多”菜单和登录后的骨架（SignedInFrame）一样放；播放页开着时后面的不能操作。该外框只有 /downloads 一页，不登记 pageTransitions，换屏按整屏淡出（AC-3 收窄）。
  改曲库和下载的提示条在登录后的外框里（没登录时不能改曲库、不能下载），这里没有。
-->
<script lang='ts'>
  import { resolve } from '$app/paths'
  import type { Snippet } from 'svelte'
  import { onDestroy } from 'svelte'

  import Brand from '../boot/Brand.svelte'
  import { setOverlays } from '../overlay/overlay-context'
  import OverlayHost from '../overlay/OverlayHost.svelte'
  import { createOverlays } from '../overlay/overlays.svelte'
  import PlayerLayer from '../player/PlayerLayer.svelte'
  import { desktopLayout } from '../shared/layout'
  import { setScrollLookup } from '../shared/scroll-marks'
  import Scrollbar from '../ui/Scrollbar.svelte'
  import { playerDockBottom } from './player-dock'
  import PlayerDock from './PlayerDock.svelte'
  import { pageScrollPadding } from './scroll-padding'

  const { children }: { children: Snippet } = $props()
  const overlays = setOverlays(createOverlays())
  const lookup = setScrollLookup({ markAt: null })
  const docked = $derived(overlays.playerLayer.hasQueue)
  const scrollPadding = pageScrollPadding()

  // 顶栏高度（桌面 64px、手机 56px）再加 8px，和两个骨架一样写在 scroll-padding-top 上（DESIGN.md Layout · 滚动）：
  // 页内定位、Tab 到的东西、焦点环都不藏在顶栏底下；换页时判断封面露没露也按它算（page-transition.ts）
  $effect(() => scrollPadding.set(desktopLayout.current ? '72px' : '64px'))
  onDestroy(scrollPadding.release)
</script>

<div class='contents' inert={overlays.stack.baseInert}>
  <div class={[
    'bg-primary-50 min-h-dvh',
    docked ? 'pb-[calc(112px+env(safe-area-inset-bottom))] md:pb-28' : 'pb-[calc(32px+env(safe-area-inset-bottom))] md:pb-12',
  ]}>
    <header class='sticky top-0 z-40 h-14 flex items-center gap-3 bg-primary-50 pl-4 pr-3 md:fixed md:inset-x-0 md:h-16 md:pl-6 md:pr-6' data-page-top>
      <a href={resolve('/')} class='rounded-lg' aria-label='Campanula · 回到登录页'><Brand /></a>
      <a
        href={resolve('/')}
        class='pill-hit ml-auto h-10 inline-flex items-center rounded-full bg-primary-900 px-5 text-label text-white font-500 transition-colors duration-feedback active:bg-primary-950 mouse:hover:bg-primary-950'
      >登录</a>
    </header>
    <main class='md:pt-16'>
      <div class='md:mx-auto md:max-w-[1200px] md:px-8 md:pt-4'>
        {@render children()}
      </div>
    </main>
  </div>
  <PlayerDock present={docked} />
  <Scrollbar page={{
    top: desktopLayout.current ? '64px' : '56px',
    bottom: playerDockBottom({ desktop: desktopLayout.current, present: docked, withoutBar: '0px' }),
  }} {lookup} />
</div>

<PlayerLayer />
<OverlayHost />

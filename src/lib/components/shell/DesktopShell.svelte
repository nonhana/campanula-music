<!--
  桌面骨架（768px 及以上，DESIGN.md Layout）：晨光底上 64px 顶栏、72px 图标侧栏（展开 220px，内容区跟着让位）、
  内容区（最大宽 1280px、左右 32px）、80px 底部通栏。只管区域和尺寸；顶栏、侧栏、底栏里放什么由调用方传进来。
  页面的滚动条贴着窗口右边，从顶栏下沿到底栏上沿；顶栏下面留出 scroll-padding-top（DESIGN.md Layout · 滚动）。
  页面里的歌曲列表从上下文拿 ScrollLookup，按住滚动条拖（平板触屏）时气泡写它最上面那首。
  换页时只有内容区在动：顶栏、侧栏、底栏各自起了名字，过渡里原地不动（view-transition-class still，见 uno.config.ts）。
  侧栏收起时先等文字淡出（SignedInFrame），再变窄
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import { setScrollLookup } from '../ui/scroll-marks'
  import Scrollbar from '../ui/Scrollbar.svelte'

  interface Props {
    /** 侧栏展开成带文字的 220px */
    railExpanded: boolean
    /** 顶栏：菜单键、logo、返回、正中的搜索框、头像 */
    header: Snippet
    /** 图标侧栏：曲库、每日推荐、已下载，设置在最下面 */
    rail: Snippet
    /** 底部通栏（播放条）；播放队列为空时不传，内容区不留底 */
    bar?: Snippet
    children: Snippet
  }

  const { railExpanded, header, rail, bar, children }: Props = $props()
  const lookup = setScrollLookup({ markAt: null })

  // Tab 到、定位到的东西不藏在顶栏底下，焦点环也露得出来
  $effect(() => {
    const { style } = document.documentElement
    style.scrollPaddingTop = '72px'
    return () => {
      style.scrollPaddingTop = ''
    }
  })
</script>

<div class='bg-primary-50 min-h-dvh' style:--rail-width={railExpanded ? '220px' : '72px'}>
  <header class='fixed inset-x-0 top-0 z-40 h-16 flex items-center gap-3 bg-primary-50 pl-4 pr-6' style:view-transition-name='shell-header' style:view-transition-class='still'>
    {@render header()}
  </header>
  <nav
    class={['fixed left-0 top-16 z-30 w-[var(--rail-width)] flex flex-col overflow-hidden px-3 pb-4 pt-2 transition-[width] duration-move-state', !railExpanded && 'delay-state-out', bar ? 'bottom-20' : 'bottom-0']}
    style:view-transition-name='shell-rail'
    style:view-transition-class='still'
    aria-label='主导航'
  >
    {@render rail()}
  </nav>
  <main class={['pt-16 transition-[padding] duration-move-state', bar ? 'pb-28' : 'pb-12']}>
    <!-- 跟着侧栏让位：和侧栏一样，收起时等文字淡出再变 -->
    <div class={['pl-[var(--rail-width)] transition-[padding] duration-move-state', !railExpanded && 'delay-state-out']}>
      <div class='mx-auto max-w-[1280px] px-8 pt-4'>
        {@render children()}
      </div>
    </div>
  </main>
  {#if bar}
    <div class='fixed inset-x-0 bottom-0 z-40 h-20 bg-white px-5 shadow-float' style:view-transition-name='player-bar' style:view-transition-class='still'>
      {@render bar()}
    </div>
  {/if}
  <Scrollbar page={{ top: '64px', bottom: bar ? '80px' : '0px' }} {lookup} />
</div>

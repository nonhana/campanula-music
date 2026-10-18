<!--
  桌面骨架（768px 及以上，DESIGN.md Layout）：晨光底上 64px 顶栏、72px 图标侧栏（展开 220px，内容区跟着让位）、
  内容区（最大宽 1280px、左右 32px）、80px 底部通栏。只管区域和尺寸；顶栏、侧栏、底栏里放什么由调用方传进来。
  页面的滚动条贴着窗口右边，从顶栏下沿到底栏上沿；顶栏下面留出 scroll-padding-top（DESIGN.md Layout · 滚动）。
  页面里的歌曲列表从上下文拿 ScrollLookup，按住滚动条拖（平板触屏）时气泡写它最上面那首。
  换页时只有内容区在动：顶栏、侧栏、底栏各自起了名字，过渡里原地不动（view-transition-class still，见 uno.config.ts）。
  侧栏收起时先等文字淡出（SignedInFrame），再变窄。
  播放条在播放队列里第一次有歌时从屏幕底下浮上来，清空（包括退出登录，整个骨架拿掉时）沉下去（motion.ts 的 dock）；
  侧栏最下面的（设置）跟着它一起上去、下来（只动 transform），不跳
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import { getAppView } from '../app-context.svelte'
  import { dock } from '../motion'
  import { setScrollLookup } from '../ui/scroll-marks'
  import Scrollbar from '../ui/Scrollbar.svelte'

  interface Props {
    /** 侧栏展开成带文字的 220px */
    railExpanded: boolean
    /** 顶栏：菜单键、logo、返回、正中的搜索框、头像 */
    header: Snippet
    /** 图标侧栏上面的：曲库、每日推荐、已下载 */
    rail: Snippet
    /** 图标侧栏最下面的：设置 */
    railEnd?: Snippet
    /** 底部通栏（播放条）；播放队列为空时不传，内容区不留底 */
    bar?: Snippet
    children: Snippet
  }

  const { railExpanded, header, rail, railEnd, bar, children }: Props = $props()
  const lookup = setScrollLookup({ markAt: null })
  const view = getAppView()
  /**
   * 播放队列真的空了（清空、退出登录）：播放条收起时才沉下去，换成手机布局、登录失效时跟着骨架直接拿掉。
   * 收起的那一刻直接读 App 的状态：骨架整个拿掉时，组件里的 $derived 停在旧的值上
   */
  const emptied = () => view.app.state.player.queue.length === 0

  // Tab 到、定位到的东西不藏在顶栏底下，焦点环也露得出来。页面里吸在顶栏下面的一行（搜索结果的标签）把自己的高度写在
  // --sticky-below-header 上，一起让出来
  $effect(() => {
    const { style } = document.documentElement
    style.scrollPaddingTop = 'calc(72px + var(--sticky-below-header, 0px))'
    return () => {
      style.scrollPaddingTop = ''
    }
  })
</script>

<div class='bg-primary-50 min-h-dvh' style:--rail-width={railExpanded ? '220px' : '72px'}>
  <header class='fixed inset-x-0 top-0 z-40 h-16 flex items-center gap-3 bg-primary-50 pl-4 pr-6' style:view-transition-name='shell-header' style:view-transition-class='still'>
    {@render header()}
  </header>
  <!-- 侧栏一直通到窗口底，播放条盖在它上面 -->
  <nav
    class={['fixed bottom-0 left-0 top-16 z-30 w-[var(--rail-width)] flex flex-col overflow-hidden px-3 pb-4 pt-2 transition-[width] duration-move-state', !railExpanded && 'delay-state-out']}
    style:view-transition-name='shell-rail'
    style:view-transition-class='still'
    aria-label='主导航'
  >
    {@render rail()}
    <!-- 最下面的让出播放条的位置：播放条浮上来时一起上去（360ms），沉下去时一起下来（200ms），不跳 -->
    {#if railEnd}
      <div class={['mt-auto transition-transform', bar ? 'duration-move-panel -translate-y-20' : 'duration-move-panel-out ease-in-soft']}>
        {@render railEnd()}
      </div>
    {/if}
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
    <!-- data-player-bar：点歌时封面飞到这里（cover-flight.svelte.ts） -->
    <div
      class='fixed inset-x-0 bottom-0 z-40 h-20 bg-white px-5 shadow-float'
      style:view-transition-name='player-bar'
      style:view-transition-class='still'
      data-player-bar
      in:dock
      out:dock|global={{ gone: emptied() }}
    >
      {@render bar()}
    </div>
  {/if}
  <Scrollbar page={{ top: '64px', bottom: bar ? '80px' : '0px' }} {lookup} />
</div>

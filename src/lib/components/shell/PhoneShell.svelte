<!--
  手机骨架（窄于 768px，DESIGN.md Layout）：顶上一行（logo、搜索、每日推荐；二级页面是返回栏），
  下面可以跟文字标签（我喜欢 / 歌单 / 专辑 / 歌手），然后是内容；底部是离屏幕边 8px 浮起的迷你播放条，
  下面垫一层晨光底的渐隐。只管区域和尺寸；每块里放什么由调用方传进来。
  页面的滚动条贴着窗口右边，从顶行（连着标签）下沿到迷你播放条上沿；顶行下面留出 scroll-padding-top（DESIGN.md Layout · 滚动）。
  页面里的歌曲列表从上下文拿 ScrollLookup，按住滚动条拖时气泡写它最上面那首。
  换页时（uno.config.ts）：顶行（logo 行 ↔ 返回栏）、标签行交叉淡化，迷你播放条和它下面的渐隐原地不动，只有内容在动
  迷你播放条在播放队列里第一次有歌时从屏幕底下浮上来、渐隐跟着淡入，清空（包括退出登录，整个骨架拿掉时）沉下去（motion.ts 的 dock）
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import { getAppView } from '../app-context.svelte'
  import { dock, fade } from '../motion'
  import { DURATIONS } from '../motion-tokens'
  import { setScrollLookup } from '../ui/scroll-marks'
  import Scrollbar from '../ui/Scrollbar.svelte'

  interface Props {
    /** 56px 高的顶行 */
    header: Snippet
    /** 跟着顶行吸在页面顶上的文字标签 */
    tabs?: Snippet
    /** 迷你播放条（64px）；播放队列为空时不传，内容不留底 */
    bar?: Snippet
    children: Snippet
  }

  const { header, tabs, bar, children }: Props = $props()
  const lookup = setScrollLookup({ markAt: null })
  const view = getAppView()
  /**
   * 播放队列真的空了（清空、退出登录）：迷你播放条收起时才沉下去，换成桌面布局、登录失效时跟着骨架直接拿掉。
   * 收起的那一刻直接读 App 的状态：骨架整个拿掉时，组件里的 $derived 停在旧的值上
   */
  const emptied = () => view.app.state.player.queue.length === 0

  /** 吸在顶上的那一块（顶行，曲库里连着文字标签）有多高 */
  let top = $state(0)

  // Tab 到、定位到的东西不藏在顶行底下，焦点环也露得出来
  $effect(() => {
    const { style } = document.documentElement
    style.scrollPaddingTop = `${top + 8}px`
    return () => {
      style.scrollPaddingTop = ''
    }
  })
</script>

<div class={['min-h-dvh bg-primary-50', bar ? 'pb-[calc(96px+env(safe-area-inset-bottom))]' : 'pb-[calc(32px+env(safe-area-inset-bottom))]']}>
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
  {#if bar}
    <div
      class='pointer-events-none fixed inset-x-0 bottom-0 z-30 h-[calc(104px+env(safe-area-inset-bottom))] from-primary-50/0 to-primary-50 bg-gradient-to-b'
      style:view-transition-name='bar-fade'
      style:view-transition-class='still'
      aria-hidden='true'
      in:fade={{ duration: DURATIONS.panel }}
      out:fade|global={{ duration: emptied() ? DURATIONS['panel-out'] : 0 }}
    ></div>
    <!-- data-player-bar：点歌时封面飞到这里（cover-flight.svelte.ts） -->
    <div
      class='fixed inset-x-2 bottom-[calc(8px+env(safe-area-inset-bottom))] z-40 h-16 overflow-hidden rounded-xl bg-white shadow-float'
      style:view-transition-name='player-bar'
      style:view-transition-class='still'
      data-player-bar
      in:dock
      out:dock|global={{ gone: emptied() }}
    >
      {@render bar()}
    </div>
  {/if}
  <Scrollbar page={{ top: `${top}px`, bottom: bar ? 'calc(72px + env(safe-area-inset-bottom))' : 'env(safe-area-inset-bottom)' }} {lookup} />
</div>

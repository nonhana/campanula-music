<!--
  手机骨架（窄于 768px，DESIGN.md Layout）：顶上一行（logo、搜索、每日推荐；二级页面是返回栏），
  下面可以跟文字标签（我喜欢 / 歌单 / 专辑 / 歌手），然后是内容；底部是离屏幕边 8px 浮起的迷你播放条，
  下面垫一层晨光底的渐隐。只管区域和尺寸；每块里放什么由调用方传进来。
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'

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
</script>

<div class={['min-h-dvh bg-primary-50', bar ? 'pb-[calc(96px+env(safe-area-inset-bottom))]' : 'pb-[calc(32px+env(safe-area-inset-bottom))]']}>
  <div class='sticky top-0 z-20 bg-primary-50'>
    <header class='h-14 flex items-center gap-1 pl-4 pr-2'>
      {@render header()}
    </header>
    {#if tabs}{@render tabs()}{/if}
  </div>
  <main>
    {@render children()}
  </main>
  {#if bar}
    <div class='pointer-events-none fixed inset-x-0 bottom-0 z-30 h-[calc(104px+env(safe-area-inset-bottom))] from-primary-50/0 to-primary-50 bg-gradient-to-b' aria-hidden='true'></div>
    <div class='fixed inset-x-2 bottom-[calc(8px+env(safe-area-inset-bottom))] z-40 h-16 overflow-hidden rounded-xl bg-white shadow-float'>
      {@render bar()}
    </div>
  {/if}
</div>

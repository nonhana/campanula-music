<!--
  桌面骨架（768px 及以上，DESIGN.md Layout）：晨光底上 64px 顶栏、72px 图标侧栏（展开 220px，内容区跟着让位）、
  内容区（最大宽 1280px、左右 32px）、80px 底部通栏。只管区域和尺寸；顶栏、侧栏、底栏里放什么由调用方传进来。
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'

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
</script>

<div class='bg-primary-50 min-h-dvh' style:--rail-width={railExpanded ? '220px' : '72px'}>
  <header class='fixed inset-x-0 top-0 z-40 h-16 flex items-center gap-3 bg-primary-50 pl-4 pr-6'>
    {@render header()}
  </header>
  <nav class={['fixed left-0 top-16 z-30 w-[var(--rail-width)] flex flex-col overflow-hidden px-3 pb-4 pt-2 transition-[width] duration-move-state', bar ? 'bottom-20' : 'bottom-0']} aria-label='主导航'>
    {@render rail()}
  </nav>
  <main class={['pl-[var(--rail-width)] pt-16 transition-[padding] duration-move-state', bar ? 'pb-28' : 'pb-12']}>
    <div class='mx-auto max-w-[1280px] px-8 pt-4'>
      {@render children()}
    </div>
  </main>
  {#if bar}
    <div class='fixed inset-x-0 bottom-0 z-40 h-20 bg-white px-5 shadow-float'>
      {@render bar()}
    </div>
  {/if}
</div>

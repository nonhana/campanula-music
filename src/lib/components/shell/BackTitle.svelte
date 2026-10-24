<!--
  手机二级页返回栏里 ← 右边的页名（DESIGN.md Layout · 手机返回栏；歌单、专辑、歌手、每日推荐、已下载）：平时不写字，页头 h1（back-title.svelte.ts）整个滚到返回栏下面以后淡入（进 200ms、出 120ms），滚回去淡出。
  换了一页（新页的 h1 接替旧的）不淡，跟着返回栏一起交叉淡化（ADR-0011）；返回一页、恢复滚动位置时直接到位。只是看的：读屏不重复读，页面的标题仍是 h1；单行、放不下截断，带页名同样的 lang。
-->
<script lang='ts'>
  import { afterNavigate } from '$app/navigation'

  import { atOnce, fade } from '../shared/motion'
  import { langOf } from '../shared/text'
  import { backBar, backTitle } from './back-title.svelte'

  // SvelteKit 恢复好滚动位置（返回一页时）才调这里：页名当场到位、不淡，换页的过渡拍新的一帧时已经是对的样子
  afterNavigate(() => atOnce(backTitle.measure))
</script>

<svelte:window onscroll={backTitle.measure} onresize={backTitle.measure} />

<span class='min-w-0 flex-1' {@attach backBar}>
  <!-- 换了一页的 h1：里面整个重建，页名不淡入淡出（Svelte 的过渡默认只在自己这一块开关时播） -->
  {#key backTitle.heading}
    {#if backTitle.shown}
      <span class='block truncate text-title-sm text-neutral-900 font-500' lang={langOf(backTitle.text)} aria-hidden='true' transition:fade>{backTitle.text}</span>
    {/if}
  {/key}
</span>

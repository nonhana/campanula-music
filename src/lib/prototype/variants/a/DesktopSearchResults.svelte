<!--
  PROTOTYPE：桌面搜索结果页（内容区里的一页，照官方客户端）。顶栏搜索框里是这次搜索的词；
  单曲 / 歌单 / 歌手 / 专辑 四个标签。点一首歌照官方做法插到当前歌后面播放。
-->
<script lang='ts'>
  import { langOf } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import SearchPanel from './SearchPanel.svelte'
</script>

<h1 class='pt-2 text-[28px] leading-9 font-600 tracking-[-0.01em] text-neutral-900'>
  “<span lang={langOf(nav.query)}>{nav.query}</span>”的搜索结果
</h1>

<div class='results mt-6 rounded-2xl bg-white p-2 shadow-ambient'>
  <SearchPanel idPrefix='dsr' />
</div>

<style>
  /* 分类标签吸在顶栏下面 */
  .results :global(.tabs) {
    top: 64px;
    border-radius: 12px 12px 0 0;
  }
</style>

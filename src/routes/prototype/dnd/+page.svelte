<!--
  PROTOTYPE：交互原型 2.1——拖拽排序和批量操作。
  三种拖动方案在同一个地址上用 ?variant=A|B|C 切换（A 长按拖动、B 拖动把手、C 编辑模式），
  三种实现用 ?engine=pointer|action|kit 切换（自写 / svelte-dnd-action / dnd-kit）；
  ?pl= 打开哪张歌单（默认是 4,815 首的自建歌单「ACG 大合集」），?screen=library 打开曲库里的自建歌单排序。
  窗口窄于 768px 是手机布局。原型切换栏和原型面板只在开发模式出现。
-->
<script lang='ts'>
  import DndWorld from '$lib/prototype/dnd/DndWorld.svelte'
</script>

<svelte:head>
  <title>Campanula · 交互原型 · 拖拽排序</title>
</svelte:head>

<DndWorld />

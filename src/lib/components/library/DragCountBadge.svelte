<!-- 一起拖几首时封面右上角的数量（#36）：浮起的那一行显示它 -->
<script lang='ts'>
  const { count }: { count: number } = $props()
</script>

{#if count > 1}
  <span
    class='absolute grid h-5 min-w-5 place-items-center rounded-full bg-primary-950 px-1.5 text-caption text-white font-600 tabular-nums ring-2 ring-white -right-1.5 -top-1.5'
    aria-hidden='true'
  >{count}</span>
{/if}

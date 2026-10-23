<script lang='ts'>
  // Vite 在分析动态导入前替换 DEV；只用 $app/env.dev 会留下已经生成的孤立 chunk（#61）。
  const design = import.meta.env.DEV ? import('#lib/dev/DesignPage.svelte') : null
</script>

{#if design}
  {#await design then { default: DesignPage }}
    <DesignPage />
  {/await}
{/if}

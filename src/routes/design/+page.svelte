<script lang="ts">
  // 用 import.meta.env.DEV：换成 $app/env 的 dev 会留下已经生成的孤立 chunk
  const design = import.meta.env.DEV
    ? import('#lib/dev/DesignPage.svelte')
    : null;
</script>

{#if design}
  {#await design then { default: DesignPage }}
    <DesignPage />
  {/await}
{/if}

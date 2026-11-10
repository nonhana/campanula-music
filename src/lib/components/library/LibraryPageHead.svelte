<script lang="ts">
  import { fade } from '../shared/motion';
  import { formatCount } from '../shared/text';
  import SearchField from '../ui/SearchField.svelte';

  interface Props {
    title: string;
    unit: '张' | '位';
    total: number | null;
    found: number | null;
    query: string;
    disabled?: boolean;
    phone?: boolean;
  }

  let {
    title,
    unit,
    total,
    found,
    query = $bindable(),
    disabled = false,
    phone = false,
  }: Props = $props();
  const label = $derived(`筛选${title}`);
</script>

{#if phone}
  <div class="px-4 pt-3">
    <SearchField {label} bind:value={query} {disabled} />
    <p class="sr-only" role="status">
      {found === null ? '' : `找到 ${formatCount(found)} ${unit}`}
    </p>
  </div>
{:else}
  <div class="mb-4 mt-6 flex items-center gap-3">
    <h1 class="text-headline text-neutral-900 font-600">{title}</h1>
    <span class="text-caption text-neutral-500 tabular-nums" role="status">
      {#if found !== null}
        <span in:fade>找到 {formatCount(found)} {unit}</span>
      {:else if total !== null}
        <span in:fade>{formatCount(total)} {unit}</span>
      {/if}
    </span>
    <SearchField
      {label}
      bind:value={query}
      {disabled}
      class="ml-auto max-w-[280px] min-w-[128px] w-full"
    />
  </div>
{/if}

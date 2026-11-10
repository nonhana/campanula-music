<script lang="ts">
  import type { Snippet } from 'svelte';

  const { children }: { children: Snippet } = $props();
</script>

<span
  class="h-6 inline-flex flex-none items-center rounded-full bg-primary-100 px-2.5 text-caption text-primary-950 font-500"
>
  {@render children()}
</span>

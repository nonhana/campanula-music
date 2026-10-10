<script lang='ts'>
  import type { Snippet } from 'svelte'

  interface Props {
    children: Snippet
  }

  const { children }: Props = $props()
</script>

<ul class='flex flex-col gap-1'>
  {@render children()}
</ul>

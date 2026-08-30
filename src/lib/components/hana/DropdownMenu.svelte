<script lang='ts'>
  import type { Snippet } from 'svelte'

  interface Props {
    children: Snippet
  }

  const { children }: Props = $props()
</script>

<ul class='flex flex-col gap-1'>
  <li class='contents'>
    {@render children()}
  </li>
</ul>

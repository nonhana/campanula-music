<script lang='ts'>
  import type { Snippet } from 'svelte'

  interface Props {
    title: string
    icon?: Snippet
    children?: Snippet
  }

  const { title, icon, children }: Props = $props()
</script>

<section class='my-6 flex items-center gap-2 text-2xl font-semibold text-neutral'>
  {@render icon?.()}
  <h1>{title}</h1>
</section>

{@render children?.()}

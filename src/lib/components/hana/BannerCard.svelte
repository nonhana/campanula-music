<script lang='ts'>
  import type { Snippet } from 'svelte'

  interface Props {
    title: string
    subtitle?: string
    icon?: Snippet
    children?: Snippet
  }

  const { title, subtitle, icon, children }: Props = $props()
</script>

<div class='my-6'>
  <section class='mb-6 flex items-center gap-2 text-2xl text-neutral'>
    {@render icon?.()}
    <h2 class='font-semibold'>{title}</h2>
    {#if subtitle}
      <p class='text-base'>{subtitle}</p>
    {/if}
  </section>
  {@render children?.()}
</div>

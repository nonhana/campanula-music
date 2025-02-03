<script lang='ts'>
  import type { Snippet } from 'svelte'

  interface Props {
    transparent?: boolean
    elevated?: boolean
    bordered?: boolean
    rounded?: boolean
    hoverable?: boolean
    divider?: boolean
    header?: Snippet
    children?: Snippet
    footer?: Snippet
    mask?: Snippet
    href?: string
  }

  const {
    transparent = false,
    elevated = true,
    bordered = false,
    rounded = true,
    hoverable = false,
    divider = true,
    header,
    children,
    footer,
    mask,
    href,
  }: Props = $props()

  const cardClasses = $derived([
    'relative overflow-hidden shrink-0',
    transparent ? 'bg-transparent' : 'bg-white',
    rounded && 'rounded-lg',
    elevated && 'shadow-lg',
    hoverable && 'cursor-pointer hover:bg-primary-200',
    bordered && 'border border-neutral-200',
  ])
</script>

{#if href}
  <a class={cardClasses} {href}>
    {@render mask?.()}
    {#if header}
      <div class={[divider && 'border-b']}>
        {@render header()}
      </div>
    {/if}
    {@render children?.()}
    {#if footer}
      <div class={[divider && 'border-t']}>
        {@render footer()}
      </div>
    {/if}
  </a>
{:else}
  <div class={cardClasses}>
    {@render mask?.()}
    {#if header}
      <div class={[divider && 'border-b']}>
        {@render header()}
      </div>
    {/if}
    {@render children?.()}
    {#if footer}
      <div class={[divider && 'border-t']}>
        {@render footer()}
      </div>
    {/if}
  </div>
{/if}

<script lang='ts'>
  import type { Pathname } from '$app/types'
  import type { Snippet } from 'svelte'
  import { resolve } from '$app/paths'

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
    onclick?: () => void
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
    onclick,
  }: Props = $props()

  const isExternal = $derived(href?.startsWith('http') ?? false)

  const cardClasses = $derived([
    'relative overflow-hidden shrink-0',
    transparent ? 'bg-transparent' : 'bg-app-surface',
    rounded && 'rounded-lg',
    elevated && 'shadow-lg',
    hoverable && 'cursor-pointer hover:bg-primary-200',
    bordered && 'border border-neutral-200',
  ])
</script>

{#snippet cardContent()}
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
{/snippet}

{#if href}
  {#if isExternal}
    <a class={cardClasses} {href} rel='external' {onclick}>
      {@render cardContent()}
    </a>
  {:else}
    <a class={cardClasses} href={resolve(href as Pathname)} {onclick}>
      {@render cardContent()}
    </a>
  {/if}
{:else if onclick}
  <button class={cardClasses} {onclick}>
    {@render cardContent()}
  </button>
{:else}
  <div class={cardClasses}>
    {@render cardContent()}
  </div>
{/if}

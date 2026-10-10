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

  const cardClasses = $derived([
    'relative overflow-hidden shrink-0',
    transparent ? 'bg-transparent' : 'bg-white',
    rounded && 'rounded-lg',
    elevated && 'shadow-lg',
    hoverable && 'cursor-pointer hover:bg-primary-200',
    bordered && 'border border-neutral-200',
  ])

// href is an arbitrary string by component contract: callers pass internal pathnames (pre-resolved via resolve() at the call site) or external URLs, which are rendered in the rel='external' branch below. This component is exempted from svelte/no-navigation-without-resolve in eslint.config.js for that reason.
</script>

{#snippet cardBody()}
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
  {#if href.startsWith('http')}
    <a class={cardClasses} {href} rel='external' {onclick}>
      {@render cardBody()}
    </a>
  {:else}
    <!-- external URLs go to the rel='external' branch above; internal callers pass route paths already -->
    <a class={cardClasses} {href} {onclick}>
      {@render cardBody()}
    </a>
  {/if}
{:else if onclick}
  <button class={cardClasses} {onclick}>
    {@render cardBody()}
  </button>
{:else}
  <div class={cardClasses}>
    {@render cardBody()}
  </div>
{/if}

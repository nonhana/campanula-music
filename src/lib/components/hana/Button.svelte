<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements'
  import { ExternalLink } from '@lucide/svelte'

  type Props = {
    variant?: 'primary' | 'secondary' | 'accent' | 'transparent' | 'none'
    shape?: 'rounded' | 'circle'
    iconButton?: boolean
    activated?: boolean
    children: Snippet
    ref?: HTMLButtonElement | HTMLAnchorElement
  } & HTMLButtonAttributes & HTMLAnchorAttributes

  let {
    class: customClasses = '',
    style,
    children,
    variant = 'primary',
    shape = 'rounded',
    iconButton,
    disabled = false,
    href,
    activated,
    ref: thisEl = $bindable(),
    ...rest
  }: Props = $props()

  const isExternal = $derived(href?.startsWith('http'))

  const baseClasses = 'cursor-pointer font-semibold focus:outline-none select-none shrink-0'
  const CommonClasses = 'px-4 py-2'
  const IconBtnClasses = 'p-2 size-10'
  const variantClasses = {
    primary: 'bg-primary-500 text-white hover:bg-primary-600 focus:bg-primary-600',
    secondary: 'bg-secondary-500 text-white hover:bg-secondary-600 focus:bg-secondary-600',
    accent: 'bg-accent-500 text-white hover:bg-accent-600 focus:bg-accent-600',
    transparent: 'bg-transparent text-neutral hover:bg-primary-200 focus:bg-primary-200',
    none: 'bg-transparent text-neutral',
  }
  const variantActivatedClasses = {
    primary: 'bg-primary-600 text-white',
    secondary: 'bg-secondary-600 text-white',
    accent: 'bg-accent-600 text-white',
    transparent: 'bg-primary-200 text-neutral',
    none: 'bg-transparent',
  }
  const shapeClasses = {
    rounded: 'rounded-lg',
    circle: 'rounded-full',
  }
  const disabledClasses = 'cursor-not-allowed opacity-50'
  const externalClasses = 'hover:text-blue'

  const computedClasses = $derived(
    `${
      baseClasses
    } ${
      iconButton ? IconBtnClasses : CommonClasses
    } ${
      activated ? variantActivatedClasses[variant] : variantClasses[variant]
    } ${
      shapeClasses[shape]
    } ${
      customClasses
    } ${
      disabled ? disabledClasses : ''
    } ${
      isExternal ? externalClasses : ''
    }`,
  )

// href is an arbitrary string by component contract: callers pass internal pathnames (pre-resolved via resolve() at the call site) or external URLs, which are rendered in the rel='external' branch below. This component is exempted from svelte/no-navigation-without-resolve in eslint.config.js for that reason.

</script>

{#if href}
  {#if isExternal}
    <a
      class={['inline-block group', computedClasses]}
      bind:this={thisEl}
      target='_blank'
      rel='external'
      {style}
      {href}
      {...rest}>
      <div role='button'>
        <div class='group-hover:hidden'>{@render children()}</div>
        <div class='mx-auto w-fit hidden group-hover:block'><ExternalLink /></div>
      </div>
    </a>
  {:else}
    <!-- external URLs go to the rel='external' branch above; internal callers pass route paths already -->
    <a
      class={['inline-block group', computedClasses]}
      bind:this={thisEl}
      {style}
      {href}
      {...rest}>
      <div role='button'>
        {@render children()}
      </div>
    </a>
  {/if}
{:else}
  <button class={computedClasses} {style} {disabled} bind:this={thisEl} {...rest}>
    {@render children()}
  </button>
{/if}

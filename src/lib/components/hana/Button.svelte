<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements'

  interface Props {
    variant?: 'primary' | 'secondary' | 'accent' | 'transparent' | 'none'
    shape?: 'rounded' | 'circle'
    iconButton?: boolean
    activated?: boolean
    children: Snippet
    ref?: HTMLButtonElement | HTMLAnchorElement
  }

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
  }: Props & HTMLButtonAttributes & HTMLAnchorAttributes = $props()

  const baseClasses = 'cursor-pointer font-semibold focus:outline-none'
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
    }`,
  )
</script>

{#if href}
  <a class='inline-block' {href} bind:this={thisEl} {...rest}>
    <div role='button' class={computedClasses} {style}>
      {@render children()}
    </div>
  </a>
{:else}
  <button class={computedClasses} {style} {disabled} bind:this={thisEl} {...rest}>
    {@render children()}
  </button>
{/if}

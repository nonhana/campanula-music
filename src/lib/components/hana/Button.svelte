<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements'

  interface Props {
    variant?: 'primary' | 'secondary' | 'accent' | 'transparent'
    shape?: 'rounded' | 'circle'
    iconButton?: boolean
    activated?: boolean
    children: Snippet
  }

  const {
    class: customClasses = '',
    style,
    children,
    variant = 'primary',
    shape = 'rounded',
    iconButton,
    disabled = false,
    href,
    activated,
    ...rest
  }: Props & HTMLButtonAttributes & HTMLAnchorAttributes = $props()

  const baseClasses = 'cursor-pointer font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2'
  const CommonClasses = 'px-4 py-2'
  const IconBtnClasses = 'p-2 size-10'
  const variantClasses = {
    primary: 'bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-500',
    secondary: 'bg-secondary-500 text-white hover:bg-secondary-600 focus:ring-secondary-500',
    accent: 'bg-accent-500 text-white hover:bg-accent-600 focus:ring-accent-500',
    transparent: 'bg-transparent text-neutral hover:bg-primary-200 focus:ring-primary-200',
  }
  const variantActivatedClasses = {
    primary: 'bg-primary-600 text-white focus:ring-primary-500',
    secondary: 'bg-secondary-600 text-white focus:ring-secondary-500',
    accent: 'bg-accent-600 text-white focus:ring-accent-500',
    transparent: 'bg-primary-200 text-neutral focus:ring-primary-200',
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
  <a class='inline-block' {href} {...rest}>
    <div role='button' class={computedClasses} {style}>
      {@render children()}
    </div>
  </a>
{:else}
  <button class={computedClasses} {style} {disabled} {...rest}>
    {@render children()}
  </button>
{/if}

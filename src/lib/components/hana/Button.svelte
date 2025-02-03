<script lang='ts'>
  import type { Snippet } from 'svelte'

  interface Props {
    class?: string
    style?: string
    variant?: 'primary' | 'secondary' | 'accent' | 'transparent'
    shape?: 'rounded' | 'circle'
    iconButton?: boolean
    href?: string
    ariaLabel?: string
    activated?: boolean
    onclick?: () => void
    children: Snippet
  }

  const {
    class: customClasses = '',
    style,
    children,
    variant = 'primary',
    shape = 'rounded',
    iconButton,
    href,
    ariaLabel = '',
    activated,
    onclick,
  }: Props = $props()

  const baseClasses = 'font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2'
  const CommonClasses = 'px-4 py-2'
  const IconBtnClasses = 'p-2'
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

  const computedClasses = $derived(
    `${baseClasses} ${
      iconButton ? IconBtnClasses : CommonClasses} ${
      activated ? variantActivatedClasses[variant] : variantClasses[variant]} ${
      shapeClasses[shape]} ${
      customClasses}`,
  )
</script>

{#if href}
  <a class='inline-block' {href} aria-label={ariaLabel} title={ariaLabel} {onclick}>
    <div role='button' class={computedClasses} {style}>
      {@render children()}
    </div>
  </a>
{:else}
  <button class={computedClasses} {style} {onclick}>
    {@render children()}
  </button>
{/if}

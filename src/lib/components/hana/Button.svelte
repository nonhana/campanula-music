<script lang='ts'>
  import type { Snippet } from 'svelte'

  interface Props {
    class?: string
    variant?: 'primary' | 'secondary' | 'accent' | 'transparent'
    iconButton?: boolean
    href?: string
    ariaLabel?: string
    onclick?: () => void
    children: Snippet
  }

  const { class: customClasses = '', children, variant = 'primary', iconButton, href, ariaLabel = '', onclick }: Props = $props()

  const baseClasses = 'rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2'
  const CommonClasses = 'px-4 py-2'
  const IconBtnClasses = 'p-2'
  const variantClasses = {
    primary: 'bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-500',
    secondary: 'bg-secondary-500 text-white hover:bg-secondary-600 focus:ring-secondary-500',
    accent: 'bg-accent-500 text-white hover:bg-accent-600 focus:ring-accent-500',
    transparent: 'bg-transparent text-neutral hover:bg-primary-200 focus:ring-primary-200',
  }

  const computedClasses = `${baseClasses} ${iconButton ? IconBtnClasses : CommonClasses} ${variantClasses[variant]} ${customClasses}`
</script>

{#if href}
  <a class='inline-block' {href} aria-label={ariaLabel} title={ariaLabel} {onclick}>
    <div class={computedClasses}>
      {@render children()}
    </div>
  </a>
{:else}
  <button class={computedClasses} {onclick}>
    {@render children()}
  </button>
{/if}

<script lang='ts'>
  import type { Pathname } from '$app/types'
  import type { Snippet } from 'svelte'
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements'
  import { resolve } from '$app/paths'
  import { ExternalLink } from '@lucide/svelte'

  interface Props extends Omit<HTMLButtonAttributes & HTMLAnchorAttributes, 'href'> {
    variant?: 'primary' | 'secondary' | 'accent' | 'transparent' | 'none'
    shape?: 'rounded' | 'circle'
    iconButton?: boolean
    activated?: boolean
    children: Snippet
    ref?: HTMLButtonElement | HTMLAnchorElement
    href?: Pathname
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
  }: Props = $props()

  const isExternal = $derived(href?.startsWith('http'))

  // 锚点没有原生 disabled，禁用态以 aria-disabled 表达并拦截默认导航
  const preventDisabledClick = (e: MouseEvent) => {
    if (disabled)
      e.preventDefault()
  }

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

  // class 入参可能是数组（clsx 风格），拼进模板串会 toString 成逗号分隔，先归一化为空格串
  const normalizedClasses = $derived(Array.isArray(customClasses) ? customClasses.join(' ') : customClasses)

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
      normalizedClasses
    } ${
      disabled ? disabledClasses : ''
    } ${
      isExternal ? externalClasses : ''
    }`,
  )

</script>

{#if href}
  {#if isExternal}
    <a
      class={['inline-block group', computedClasses]}
      bind:this={thisEl}
      target='_blank'
      rel='external'
      aria-disabled={disabled || undefined}
      onclick={preventDisabledClick}
      {style}
      {href}
      {...rest}>
      <div role='button'>
        <div class='group-hover:hidden'>{@render children()}</div>
        <div class='mx-auto w-fit hidden group-hover:block'><ExternalLink /></div>
      </div>
    </a>
  {:else}
    <a
      class={['inline-block group', computedClasses]}
      bind:this={thisEl}
      aria-disabled={disabled || undefined}
      onclick={preventDisabledClick}
      {style}
      href={resolve(href)}
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

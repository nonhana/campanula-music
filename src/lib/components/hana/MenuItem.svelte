<script lang='ts'>
  import type { MenuItemInfo } from '$lib/types'
  import type { Snippet } from 'svelte'
  import { selectedMenu } from '$lib/stores'
  import { getContext } from 'svelte'
  import Button from './Button.svelte'

  interface Props extends MenuItemInfo {
    icon?: Snippet
  }

  const { key, title, icon, disabled }: Props = $props()

  const { select, registerPosition, hoverEffect } = getContext<{
    select: (key: string, rect?: DOMRect) => void
    registerPosition: (key: string, rect: DOMRect) => void
    hoverEffect: boolean
  }>('menu')

  const activated = $derived($selectedMenu === key)
  let buttonElement = $state<HTMLButtonElement | HTMLAnchorElement>()

  $effect(() => {
    if (activated && buttonElement) {
      registerPosition(key, buttonElement.getBoundingClientRect())
    }
  })

  const onclick = () => {
    if (!disabled) {
      select(key, buttonElement?.getBoundingClientRect())
    }
  }

  const buttonVariant = $derived.by(() => hoverEffect ? 'transparent' : 'none')

  // hoverEffect 关闭时 Button 无内置激活态，用自定义类补齐高亮
  const customClass = $derived.by(() => !hoverEffect && activated ? 'text-primary-700' : '')
</script>

<Button
  {activated}
  {disabled}
  {onclick}
  variant={buttonVariant}
  bind:ref={buttonElement}
  class={customClass}
>
  {@render icon?.()}
  {title}
</Button>

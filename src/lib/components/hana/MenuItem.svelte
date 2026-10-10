<script lang='ts'>
  import type { MenuItemInfo } from '$lib/types'
  import type { Snippet } from 'svelte'
  import { selectedMenu } from '$lib/stores'
  import { getContext, onMount } from 'svelte'
  import Button from './Button.svelte'

  type Props = MenuItemInfo & {
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

  onMount(() => {
    // 初始状态下，如果当前项是激活状态，立即上报位置
    if (activated && buttonElement) {
      registerPosition(key, buttonElement.getBoundingClientRect())
    }
  })

  // 监听激活状态变化，如果被激活则上报位置
  $effect(() => {
    if (activated && buttonElement) {
      registerPosition(key, buttonElement.getBoundingClientRect())
    }
  })

  const onclick = () => {
    if (!disabled) {
      // 点击时传入当前元素的位置信息
      select(key, buttonElement?.getBoundingClientRect())
    }
  }

  // 根据是否启用悬停效果选择合适的变体
  const buttonVariant = $derived.by(() => hoverEffect ? 'transparent' : 'none')

  // 添加自定义类，当不使用悬停效果时，手动控制激活状态的样式
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

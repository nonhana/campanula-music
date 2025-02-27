<script lang='ts'>
  import type { MenuItemInfo } from '$lib/types'
  import { getContext } from 'svelte'
  import Button from './Button.svelte'

  type Props = MenuItemInfo & {
    icon?: $$Generic<() => any>
  }

  const { key, title, icon, disabled }: Props = $props()

  // 从上下文获取激活状态和选择函数
  const { activeKey, select } = getContext('menu')

  // 使用派生状态检查当前项是否激活
  let activated = $derived($activeKey === key)

  function handleClick() {
    if (!disabled) {
      select(key)
    }
  }
</script>

<Button {activated} {disabled} on:click={handleClick}>
  {#if icon}
    {@render icon()}
  {/if}
  {title}
</Button>

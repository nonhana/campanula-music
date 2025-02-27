<script lang='ts'>
  import type { Snippet } from 'svelte'
  import { setContext } from 'svelte'
  import { writable } from 'svelte/store'

  interface Props {
    class?: string
    defaultActive?: string
    mode?: 'horizontal' | 'vertical'
    onselect?: (key: string) => void
    children?: Snippet
  }

  const {
    class: customClass = '',
    defaultActive,
    mode = 'horizontal',
    onselect,
  }: Props = $props()

  const activeKey = writable(defaultActive)

  // 将激活的键和选择处理函数设置到上下文中
  setContext('menu', {
    activeKey,
    select: (key: string) => {
      activeKey.set(key)
      onselect?.(key)
    },
  })

  // 为了保持与原API的兼容性
  let activatedKey = $derived($activeKey)

  $effect(() => {
    // 触发onselect回调
    if (activatedKey)
      onselect?.(activatedKey)
  })
</script>

<div class={['flex gap-5', mode === 'vertical' && 'flex-col', customClass]}>
  <slot />
</div>

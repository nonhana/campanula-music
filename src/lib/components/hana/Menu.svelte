<script lang='ts'>
  import type { Snippet } from 'svelte'
  import { setContext } from 'svelte'
  import { writable } from 'svelte/store'

  interface Props {
    class?: string
    defaultActive?: string
    mode?: 'horizontal' | 'vertical'
    children?: Snippet
    onselect?: (key: string) => void
    hoverEffect?: boolean
  }

  const {
    class: customClass = '',
    defaultActive,
    mode = 'horizontal',
    onselect,
    children,
    hoverEffect = false,
  }: Props = $props()

  const activeKey = writable(defaultActive)
  const activeItemRect = writable<DOMRect | null>(null)

  let menuEl: HTMLDivElement

  setContext('menu', {
    activeKey,
    hoverEffect,
    select: (key: string, rect?: DOMRect) => {
      activeKey.set(key)
      if (rect)
        activeItemRect.set(rect)
      onselect?.(key)
    },
    registerPosition: (key: string, rect: DOMRect) => {
      if ($activeKey === key) {
        activeItemRect.set(rect)
      }
    },
  })

  const activatedKey = $derived($activeKey)

  $effect(() => {
    if (activatedKey) {
      onselect?.(activatedKey)
    }
  })

  // 计算背景元素的位置和尺寸
  const backgroundStyle = $derived.by(() => {
    const rect = $activeItemRect
    if (!rect || !menuEl)
      return 'opacity: 0'

    // 获取菜单容器的边界框，用于计算相对位置
    const menuRect = menuEl.getBoundingClientRect()
    const left = rect.left - menuRect.left
    const top = rect.top - menuRect.top

    return `
      opacity: 1;
      width: ${rect.width}px;
      height: ${rect.height}px;
      transform: translate(${left}px, ${top}px);
    `
  })
</script>

<div class={['flex gap-5 relative', mode === 'vertical' && 'flex-col', customClass]} bind:this={menuEl}>
  <div
    class='absolute z-0 rounded-lg bg-primary-100 transition-all duration-300 ease-in-out'
    style={backgroundStyle}
    aria-hidden='true'
  ></div>
  <div class="relative z-10 flex gap-5 {mode === 'vertical' ? 'flex-col' : ''}">
    {@render children?.()}
  </div>
</div>

<script lang='ts'>
  import type { Component } from 'svelte'
  import { onMount } from 'svelte'

  interface Props {
    activeKey: string
    components: Record<string, Component>
  }

  const { activeKey, components }: Props = $props()

  let previousKey = $state(activeKey)
  let direction = $state<'left' | 'right'>('right')
  let transitioning = $state(false)

  const ActiveComponent = $derived(components[activeKey])
  const PreviousComponent = $derived(components[previousKey])

  // 获取组件键的列表，用于确定动画方向
  const keysOrder = Object.keys(components)

  $effect(() => {
    if (activeKey !== previousKey && activeKey in components) {
      // 确定动画方向
      const prevIndex = keysOrder.indexOf(previousKey)
      const currentIndex = keysOrder.indexOf(activeKey)
      direction = currentIndex > prevIndex ? 'left' : 'right'

      // 开始过渡动画
      transitioning = true

      // 过渡结束后更新previousKey
      setTimeout(() => {
        previousKey = activeKey
        transitioning = false
      }, 300) // 与Menu组件的过渡时间保持一致
    }
  })

  onMount(() => {
    previousKey = activeKey
  })
</script>

<div class='relative h-full w-full overflow-hidden'>
  <!-- 当前激活的组件容器 -->
  <div
    class='absolute h-full w-full transition-all duration-1000 ease-in-out'
    style={`
      transform: translateX(${transitioning ? '0' : '0'});
      opacity: 1;
      z-index: 2;
    `}
  >
    <ActiveComponent />
  </div>

  <!-- 前一个组件，仅在过渡期间显示 -->
  {#if transitioning && previousKey !== activeKey && previousKey in components}
    <div
      class='absolute h-full w-full transition-all duration-1000 ease-in-out'
      style={`
        transform: translateX(${direction === 'left' ? '-100%' : '100%'});
        opacity: 0;
        z-index: 1;
      `}
    >
      <PreviousComponent />
    </div>
  {/if}
</div>

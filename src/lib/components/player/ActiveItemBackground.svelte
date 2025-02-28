<script lang='ts'>
  import { Spring } from 'svelte/motion'

  interface Props {
    activeIndex: number | null
    itemSize: number
    startIndex: number
  }

  const { activeIndex, itemSize, startIndex }: Props = $props()

  // 使用 spring 动画实现平滑过渡
  const position = new Spring({ y: 0 }, {
    stiffness: 0.15,
    damping: 0.8,
  })

  // 当激活项位置变化时更新动画目标位置
  $effect(() => {
    if (activeIndex !== null) {
      const relativeIndex = activeIndex - startIndex
      position.set({ y: relativeIndex * itemSize })
    }
  })
</script>

<div
  class={['absolute left-0 z-0 w-full rounded-lg bg-primary-50 transition-opacity duration-300', activeIndex === null && 'opacity-0']}
  style={`transform: translateY(${$position.y}px); height: ${itemSize}px;`}
></div>

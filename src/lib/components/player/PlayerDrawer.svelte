<script lang='ts'>
  import { setStyles } from '$lib/utils'
  import Detail from './Detail.svelte'

  interface Props {
    showDrawer: boolean
    currentProgress: number
    handleInput: (e: Event) => void
    handleChange: (e: Event) => void
    handlePointerDown: () => void
    paused: boolean
    togglePaused: () => void
  }

  let {
    showDrawer = $bindable(),
    currentProgress,
    handleInput,
    handleChange,
    handlePointerDown,
    paused,
    togglePaused,
  }: Props = $props()

  let drawerElement = $state<HTMLDivElement | null>(null)

  // 抽屉与顶部的距离，单位为 dvh（0 表示完全展开，100 表示收起）
  let top = $state(100)

  $effect(() => {
    if (showDrawer) {
      requestAnimationFrame(() => {
        top = 0
      })
    }
    else {
      requestAnimationFrame(() => {
        top = 100
      })
    }
  })

  // 拖拽状态相关变量
  let dragging = $state(false)
  let startY = 0
  let initialTop = 0

  // 打开抽屉动画：设置过渡并将 top 设为 0
  const openDrawer = () => {
    setStyles(drawerElement, { transition: 'all 0.3s' })
    requestAnimationFrame(() => {
      top = 0
    })
  }

  // 关闭抽屉动画：设置过渡并将 top 设为 100，然后等待动画结束再隐藏
  const closeDrawer = () => {
    setStyles(drawerElement, { transition: 'all 0.3s' })
    requestAnimationFrame(() => {
      top = 100
    })
    // 动画 300ms 结束后隐藏抽屉
    setTimeout(() => {
      showDrawer = false
    }, 300)
  }

  // 拖拽事件
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging)
      return
    const deltaY = e.clientY - startY
    const dvh = (deltaY / window.innerHeight) * 100
    top = initialTop + dvh
    if (top < 0)
      top = 0
    if (top > 100)
      top = 100
  }

  const onPointerUp = () => {
    dragging = false
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    // 重新启用动画
    setStyles(drawerElement, { transition: 'all 0.3s' })
    // 判断吸附效果：如果释放时 top < 50 则吸附至上侧，否则吸附至下侧
    if (top < 50) {
      openDrawer()
      showDrawer = true // 保持显示
    }
    else {
      closeDrawer()
    }
  }

  const onPointerDown = (e: PointerEvent) => {
    startY = e.clientY
    initialTop = top
    dragging = true
    // 禁用动画保证跟随鼠标无延迟
    setStyles(drawerElement, { transition: 'none' })
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  // 点击滑块时的切换逻辑（非拖拽）
  const toggleShowDrawer = () => {
    if (dragging)
      return
    if (showDrawer) {
      closeDrawer()
    }
    else {
      showDrawer = true
      requestAnimationFrame(() => {
        openDrawer()
      })
    }
  }
</script>

{#if showDrawer || dragging}
  <div
    bind:this={drawerElement}
    class='z-30 fixed left-0 w-full h-full bg-neutral-200/40 backdrop-blur flex justify-center items-center'
    style={`top: ${top}dvh;`}
  >
    <button
      aria-label='drawer dragger'
      class='absolute top-5 m-auto w-10 h-2 rounded-full bg-neutral cursor-grab active:cursor-grabbing'
      onclick={toggleShowDrawer}
      onpointerdown={onPointerDown}
    ></button>
    <Detail
      {currentProgress}
      {handleInput}
      {handleChange}
      {handlePointerDown}
      {paused}
      {togglePaused}
    />
  </div>
{/if}

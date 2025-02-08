<script lang='ts'>
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

  // 打开抽屉动画：设置过渡并将 top 设为 0
  const openDrawer = () => {
    requestAnimationFrame(() => {
      top = 0
    })
  }

  // 关闭抽屉动画：设置过渡并将 top 设为 100，然后等待动画结束再隐藏
  const closeDrawer = () => {
    requestAnimationFrame(() => {
      top = 100
    })
    setTimeout(() => {
      showDrawer = false
    }, 300)
  }

  // 逻辑：
  // 父组件传递 showDrawer 为 true 时，打开抽屉
  // 子组件接管 showDrawer，手动关闭抽屉
  $effect(() => {
    if (showDrawer) {
      openDrawer()
    }
  })

  // 拖拽状态相关变量
  let dragging = $state(false)
  let startY = 0
  let initialTop = 0

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
    // 判断吸附效果：如果释放时 top < 50 则吸附至上侧，否则吸附至下侧
    if (top < 50) {
      openDrawer()
    }
    else {
      closeDrawer()
    }
  }

  const onPointerDown = (e: PointerEvent) => {
    startY = e.clientY
    initialTop = top
    dragging = true
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
      openDrawer()
    }
  }
</script>

{#if showDrawer || dragging}
  <div
    bind:this={drawerElement}
    class={[
      'z-30 fixed left-0 w-full h-full bg-neutral-200/40 backdrop-blur flex justify-center items-center',
      !dragging && 'transition-all duration-300',
    ]}
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

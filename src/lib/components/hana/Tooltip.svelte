<script lang='ts'>
  import type { Snippet } from 'svelte'
  import { onMount } from 'svelte'

  interface Props {
    class?: string
    disabled?: boolean
    content?: string
    position?: 'top' | 'bottom' | 'left' | 'right'
    offset?: 'start' | 'center' | 'end'
    trigger?: 'hover' | 'click'
    closeOnBlur?: boolean
    children?: Snippet
    fragment?: Snippet<[close: () => void]>
  }

  const {
    class: customClasses = '',
    disabled = false,
    content = '',
    position = 'bottom',
    offset = 'center',
    trigger = 'hover',
    closeOnBlur = true,
    children,
    fragment,
  }: Props = $props()

  let visible = $state(false)
  const hoverTrigger = trigger === 'hover'
  const clickTrigger = trigger === 'click'

  let closeTimeout: ReturnType<typeof setTimeout> | null = null

  const toggleVisible = (value: boolean) => {
    if (disabled)
      return
    visible = value
  }
  const open = () => {
    if (closeTimeout) {
      clearTimeout(closeTimeout)
      closeTimeout = null
    }
    toggleVisible(true)
  }
  const close = () => {
    toggleVisible(false)
  }

  // 延时关闭 Tooltip 的函数
  const closeWithDelay = () => {
    // 设置一个延时，比如 200ms，根据实际需求调整
    closeTimeout = setTimeout(() => {
      close()
    }, 200)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      clickTrigger && close()
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      clickTrigger && open()
    }
  }

  let triggerElement: HTMLDivElement | null = null
  let tooltipElement: HTMLDivElement | null = null

  const handleOutSideClick = (e: MouseEvent) => {
    if (!closeOnBlur || !visible)
      return
    if (
      tooltipElement
      && triggerElement
      && !tooltipElement.contains(e.target as Node)
      && !triggerElement.contains(e.target as Node)
    ) {
      close()
    }
  }

  let triggerWidth = $state(0)
  let observer: IntersectionObserver | null = null

  onMount(() => {
    document.addEventListener('click', handleOutSideClick)
    observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        triggerWidth = entry.boundingClientRect.width
      }
    }, { threshold: 1 })
    if (triggerElement) {
      observer.observe(triggerElement)
    }

    return () => {
      document.removeEventListener('click', handleOutSideClick)
      if (observer) {
        observer.disconnect()
      }
    }
  })

  const offsetStyle = $derived.by(() => {
    const triggerHalfWidth = `${triggerWidth / 2}px`
    const styles = []
    if ((position === 'top' || position === 'bottom') && offset === 'center') {
      styles.push('left: 50%', 'transform: translateX(-50%)')
    }
    if ((position === 'top' || position === 'bottom') && offset === 'end') {
      styles.push('right: 50%', `transform: translateX(${triggerHalfWidth})`)
    }
    if ((position === 'top' || position === 'bottom') && offset === 'start') {
      styles.push('left: 50%', `transform: translateX(-${triggerHalfWidth})`)
    }
    if (position !== 'top' && position !== 'bottom' && offset === 'center') {
      styles.push('top: 50%', 'transform: translateY(-50%)')
    }
    if (position !== 'top' && position !== 'bottom' && offset === 'end') {
      styles.push('bottom: 50%', `transform: translateY(${triggerHalfWidth})`)
    }
    if (position !== 'top' && position !== 'bottom' && offset === 'start') {
      styles.push('top: 50%', `transform: translateY(-${triggerHalfWidth})`)
    }
    return styles.join('; ')
  })

  const positionClass = $derived.by(() => {
    switch (position) {
      case 'top':
        return 'bottom-full mb-2'
      case 'bottom':
        return 'top-full mt-2'
      case 'left':
        return 'right-full mr-2'
      case 'right':
        return 'left-full ml-2'
      default:
        return ''
    }
  })
</script>

<div class={['relative size-fit', customClasses]}>
  <div
    bind:this={triggerElement}
    role='button'
    tabindex='0'
    class='cursor-auto'
    onclick={() => clickTrigger && toggleVisible(!visible)}
    onmouseenter={() => hoverTrigger && open()}
    onmouseleave={() => hoverTrigger && closeWithDelay()}
    onkeydown={handleKeyDown}
  >
    {@render children?.()}
  </div>

  <div
    bind:this={tooltipElement}
    role='button'
    tabindex='0'
    class={['absolute z-10 cursor-auto', visible ? 'block' : 'hidden', positionClass]}
    style={offsetStyle}
    onmouseenter={() => hoverTrigger && open()}
    onmouseleave={() => hoverTrigger && closeWithDelay()}
  >
    <div class={[
      'relative min-w-max max-w-60 text-center',
      'bg-white rounded-lg p-2 text-neutral',
      content ? 'px-4 py-2' : 'p-1',
    ]}>
      {#if fragment}
        {@render fragment(close)}
      {:else}
        <span class='text-neutral'>{content}</span>
      {/if}
    </div>
  </div>
</div>

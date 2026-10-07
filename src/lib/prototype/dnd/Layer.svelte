<!--
  PROTOTYPE：浮层外壳（照视觉原型的 SongMenu / PlaylistEditor）：
  sheet 底部弹层（手机触屏）、popover 贴着按钮或指针的浮动菜单（鼠标）、dialog 居中弹窗（桌面上要打断一下的确认）。
  Esc 关闭；打开后焦点落进来。
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import { fade, fly } from 'svelte/transition'

  interface Props {
    kind: 'sheet' | 'popover' | 'dialog'
    x?: number
    y?: number
    width?: number
    label: string
    role?: 'menu' | 'dialog'
    onclose: () => void
    children: Snippet
  }

  const { kind, x = 0, y = 0, width = 248, label, role = 'dialog', onclose, children }: Props = $props()

  let h = $state(320)
  let box = $state<HTMLElement>()

  const pos = $derived.by(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    let left = x - width
    if (left < 8)
      left = Math.min(x, vw - width - 8)
    let top = y
    if (top + h > vh - 8)
      top = Math.max(8, y - h - 8)
    return { left, top }
  })

  function focusFirst(node: HTMLElement) {
    queueMicrotask(() => node.querySelector<HTMLElement>('[data-autofocus], [role="menuitem"], button, input')?.focus({ preventScroll: true }))
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onclose()
      return
    }
    if (role !== 'menu' || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp'))
      return
    e.preventDefault()
    const list = box ? [...box.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')] : []
    const i = list.indexOf(document.activeElement as HTMLElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % list.length : (i - 1 + list.length) % list.length
    list[next]?.focus()
  }
</script>

{#if kind === 'sheet'}
  <div class='fixed inset-0 z-[80]' role='presentation'>
    <button class='absolute inset-0 bg-neutral-900/30' aria-label='关闭' tabindex='-1' onclick={onclose} transition:fade={{ duration: 180 }}></button>
    <div
      bind:this={box}
      class='absolute inset-x-0 bottom-0 max-h-[calc(100dvh-48px)] overflow-y-auto rounded-t-3xl bg-white px-2 pt-2 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-float'
      {role}
      tabindex='-1'
      aria-label={label}
      {onkeydown}
      {@attach focusFirst}
      transition:fly={{ y: 360, duration: 320, opacity: 1, easing: t => 1 - (1 - t) ** 4 }}
    >
      <div class='mx-auto mb-2 h-1 w-9 rounded-full bg-neutral-300' aria-hidden='true'></div>
      {@render children()}
    </div>
  </div>
{:else if kind === 'popover'}
  <div
    class='fixed inset-0 z-[80]'
    role='presentation'
    onclick={onclose}
    oncontextmenu={(e) => {
      e.preventDefault()
      onclose()
    }}
  ></div>
  <div
    bind:this={box}
    bind:offsetHeight={h}
    class='fixed z-[81] max-h-[calc(100dvh-16px)] overflow-y-auto rounded-xl bg-white p-1.5 shadow-float'
    style:left='{pos.left}px'
    style:top='{pos.top}px'
    style:width='{width}px'
    {role}
    tabindex='-1'
    aria-label={label}
    {onkeydown}
    {@attach focusFirst}
    transition:fly={{ y: -4, duration: 160, easing: t => 1 - (1 - t) ** 3 }}
  >
    {@render children()}
  </div>
{:else}
  <div class='fixed inset-0 z-[80]' role='presentation'>
    <button class='absolute inset-0 bg-neutral-900/35' aria-label='关闭' tabindex='-1' onclick={onclose} transition:fade={{ duration: 180 }}></button>
    <div class='pointer-events-none absolute inset-0 grid place-items-center p-6'>
      <div
        bind:this={box}
        class='pointer-events-auto w-full rounded-2xl bg-white shadow-float'
        style:max-width='{width}px'
        role='dialog'
        aria-modal='true'
        aria-label={label}
        tabindex='-1'
        {onkeydown}
        {@attach focusFirst}
        transition:fly={{ y: 8, duration: 200, easing: t => 1 - (1 - t) ** 3 }}
      >
        {@render children()}
      </div>
    </div>
  </div>
{/if}

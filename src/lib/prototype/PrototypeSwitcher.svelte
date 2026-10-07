<!-- PROTOTYPE：原型变体切换条，只在开发模式显示。←/→ 键也能切换（输入框里不拦截）。 -->
<script lang='ts'>
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { ChevronLeft, ChevronRight } from '@lucide/svelte'

  interface Props {
    variants: { key: string, name: string }[]
    current: string
  }

  const { variants, current }: Props = $props()

  const index = $derived(Math.max(0, variants.findIndex(v => v.key === current)))

  function go(delta: number) {
    const next = variants[(index + delta + variants.length) % variants.length]
    const url = new URL(page.url)
    url.searchParams.set('variant', next.key)
    goto(url, { replaceState: true, keepFocus: true, noScroll: true })
  }

  function onkeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null
    if (target?.closest('input, textarea, select, [contenteditable]'))
      return
    if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey)
      return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go(-1)
    }
    else if (e.key === 'ArrowRight') {
      e.preventDefault()
      go(1)
    }
  }
</script>

<svelte:window {onkeydown} />

{#if import.meta.env.DEV}
  <div class='proto-switcher' role='toolbar' aria-label='原型变体切换'>
    <button type='button' aria-label='上一个变体' onclick={() => go(-1)}>
      <ChevronLeft size={18} />
    </button>
    <span class='label'>原型 {variants[index].key} · {variants[index].name}</span>
    <button type='button' aria-label='下一个变体' onclick={() => go(1)}>
      <ChevronRight size={18} />
    </button>
  </div>
{/if}

<style>
  .proto-switcher {
    position: fixed;
    left: 50%;
    bottom: calc(env(safe-area-inset-bottom) + 112px);
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px;
    transform: translateX(-50%);
    border-radius: 9999px;
    background: #0a0f1a;
    color: #fff;
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 12px;
    box-shadow: 0 6px 24px rgb(0 0 0 / 0.35);
    user-select: none;
  }

  .label {
    padding: 0 10px;
    white-space: nowrap;
  }

  button {
    display: grid;
    width: 32px;
    height: 32px;
    place-items: center;
    border-radius: 9999px;
    color: #fff;
  }

  button:hover {
    background: rgb(255 255 255 / 0.14);
  }

  button:focus-visible {
    outline: 2px solid #a8e6cf;
    outline-offset: 1px;
  }
</style>

<script lang='ts'>
  import type { Snippet } from 'svelte'
  import { X } from 'lucide-svelte'
  import { onMount } from 'svelte'

  interface Props {
    class?: string
    overlayClass?: string
    open?: boolean
    title?: string
    hideCloseButton?: boolean
    ariaLabel?: string
    closeOnEsc?: boolean
    closeOnOverlay?: boolean
    preventScroll?: boolean
    header?: Snippet<[close: () => void]>
    content?: Snippet<[close: () => void]>
    footer?: Snippet<[close: () => void]>
    children?: Snippet
    onopen?: () => void
    onclose?: () => void
  }

  let {
    class: panelClass = '',
    overlayClass = '',
    open = $bindable(false),
    title,
    hideCloseButton = false,
    ariaLabel,
    closeOnEsc = true,
    closeOnOverlay = true,
    preventScroll = true,
    header,
    content,
    footer,
    children,
    onopen,
    onclose,
  }: Props = $props()

  let overlayElement = $state<HTMLDivElement | null>(null)
  let panelElement = $state<HTMLDivElement | null>(null)
  let previouslyFocused: HTMLElement | null = null

  const labelId = `modal-title-${Math.random().toString(36).slice(2)}`

  function close() {
    if (open)
      open = false
  }

  function focusFirstWithin() {
    if (!panelElement)
      return
    const focusable = panelElement.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    ;(focusable[0] || panelElement).focus()
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!open)
      return
    if (e.key === 'Escape' && closeOnEsc) {
      e.preventDefault()
      close()
      return
    }
    if (e.key !== 'Tab' || !panelElement)
      return
    const focusable = Array.from(
      panelElement.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1)
    if (focusable.length === 0)
      return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement as HTMLElement | null
    if (e.shiftKey) {
      if (active === first || !panelElement.contains(active)) {
        e.preventDefault()
        last.focus()
      }
    }
    else {
      if (active === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  function handleOverlayClick(e: MouseEvent) {
    if (!closeOnOverlay)
      return
    if (e.target === overlayElement) {
      close()
    }
  }

  function lockScroll() {
    const original = document.body.style.overflow
    document.body.dataset.__modalOverflow = original
    document.body.style.overflow = 'hidden'
  }

  function unlockScroll() {
    const original = document.body.dataset.__modalOverflow ?? ''
    document.body.style.overflow = original
    delete document.body.dataset.__modalOverflow
  }

  $effect(() => {
    if (open) {
      previouslyFocused = document.activeElement as HTMLElement | null
      if (preventScroll)
        lockScroll()
      document.addEventListener('keydown', handleKeyDown)
      queueMicrotask(() => focusFirstWithin())
      onopen?.()
    }
    else {
      document.removeEventListener('keydown', handleKeyDown)
      if (preventScroll)
        unlockScroll()
      previouslyFocused?.focus?.()
      onclose?.()
    }
  })

  onMount(() => {
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (preventScroll)
        unlockScroll()
    }
  })
</script>

{#if open}
  <div
    bind:this={overlayElement}
    class={[
      'fixed inset-0 z-50 flex items-center justify-center p-4',
      'bg-neutral-900/50',
      overlayClass,
    ]}
    onclick={handleOverlayClick}
    role='presentation'
  >
    <div
      bind:this={panelElement}
      class={[
        'w-full max-w-xl rounded-xl bg-white shadow-lg outline-none',
        'transition-[opacity,transform] duration-200 ease-out',
        'opacity-100 scale-100',
        panelClass,
      ]}
      role='dialog'
      aria-modal='true'
      aria-labelledby={title ? labelId : undefined}
      aria-label={!title ? ariaLabel : undefined}
      tabindex='-1'
    >
      {#if !hideCloseButton || title}
        <div class='flex items-center justify-between gap-4 px-5 pt-5'>
          {#if title}
            <h2 id={labelId} class='text-lg text-neutral-700 font-bold'>{title}</h2>
          {/if}
          {#if !hideCloseButton}
            <button
              class='rounded-md p-1 text-neutral -mr-1 hover:bg-neutral-100'
              aria-label='Close modal'
              onclick={close}
            >
              <X class='size-5' />
            </button>
          {/if}
        </div>
      {/if}

      {#if header}
        <div class='px-5 pt-3'>
          {@render header(close)}
        </div>
      {/if}

      <div class='px-5 py-4 text-neutral'>
        {#if content}
          {@render content(close)}
        {:else}
          {@render children?.()}
        {/if}
      </div>

      {#if footer}
        <div class='px-5 pb-5 pt-2'>
          {@render footer(close)}
        </div>
      {/if}
    </div>
  </div>
{/if}

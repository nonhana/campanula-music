<script lang='ts'>
  import type { Snippet } from 'svelte'
  import Button from '$lib/components/hana/Button.svelte'
  import { X } from 'lucide-svelte'
  import { cubicInOut } from 'svelte/easing'
  import { fly } from 'svelte/transition'

  interface Props {
    visible: boolean
    title?: string
    hideHeader?: boolean
    direction?: 'left' | 'right'
    overlayOpacity?: number
    width?: string
    icon?: Snippet
    header?: Snippet
    children?: Snippet<[() => void]>
    footer?: Snippet<[() => void]>
  }

  let {
    visible = $bindable(false),
    title,
    hideHeader = false,
    direction = 'right',
    overlayOpacity = 0.5,
    width = '240px',
    icon,
    header,
    children,
    footer,
  }: Props = $props()

  const handleClose = () => {
    visible = false
  }

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleClose()
    }
  }

  const getTransitionParams = () => ({
    x: direction === 'right' ? 320 : -320,
    duration: 300,
    easing: cubicInOut,
  })
</script>

{#if visible}
  <aside
    class={[
      'fixed top-0 z-50 w-4/5 flex flex-col bg-white px-5 h-dvh',
      direction === 'right' ? 'right-0' : 'left-0',
    ]}
    style={`max-width: ${width};`}
    transition:fly={getTransitionParams()}
  >
    {#if !hideHeader}
      {#if header}
        {@render header()}
      {:else}
        <div class='h-16 flex items-center gap-2 text-neutral'>
          {@render icon?.()}
          <span class='flex-1 text-xl'>{title ?? ''}</span>
          <Button shape='circle' variant='transparent' iconButton onclick={handleClose}>
            <X />
          </Button>
        </div>
        <hr class='border-primary -mx-5'>
      {/if}
    {/if}
    <div class='mt-5 flex-1 overflow-auto'>
      {@render children?.(handleClose)}
    </div>
    {#if footer}
      <div class='my-5'>
        <hr class='mb-5 border-primary'>
        {@render footer(handleClose)}
      </div>
    {/if}
  </aside>
{/if}

<div
  class={[
    'fixed inset-0 z-40 bg-black transition-opacity duration-300',
    !visible && 'pointer-events-none',
  ]}
  style:opacity={visible ? overlayOpacity : 0}
  onclick={handleClose}
  onkeydown={handleKeydown}
  role='button'
  tabindex='0'
></div>

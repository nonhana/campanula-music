<script lang='ts'>
  import type { Snippet } from 'svelte'
  import Tooltip from '$lib/components/hana/Tooltip.svelte'

  interface Props {
    position?: 'top' | 'bottom' | 'left' | 'right'
    offset?: 'start' | 'center' | 'end'
    trigger?: 'hover' | 'click'
    clickClose?: boolean
    oncommand?: (command: string | number | object) => void
    dropdown?: Snippet<[click: () => void]>
    children?: Snippet
  }

  const {
    position = 'bottom',
    offset = 'center',
    trigger = 'hover',
    clickClose = true,
    oncommand,
    dropdown,
    children,
  }: Props = $props()

  // 事件委托
  const handleClick = (e: MouseEvent, fn: () => void) => {
    const target = e.target as HTMLElement
    target.dataset.command && oncommand && oncommand(target.dataset.command)
    clickClose && fn()
  }
</script>

<Tooltip isDropdown {position} {offset} {trigger}>
  {@render children?.()}
  {#snippet fragment(close)}
    <button onclick={e => handleClick(e, close)}>
      {@render dropdown?.(close)}
    </button>
  {/snippet}
</Tooltip>

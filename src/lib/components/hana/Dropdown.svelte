<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { Action } from 'svelte/action'
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

  // 面板点击委托：条目内含图标时 e.target 命中的是图标而非条目本体，需沿祖先链回溯 data-command。
  // 监听经 action 挂载而非 onclick 标记：面板是纯容器（条目各自可聚焦），不应被强加交互元素语义
  const panelClick: Action<HTMLElement, () => void> = (node, close) => {
    let requestClose = close
    const onClick = (e: MouseEvent) => {
      const command = (e.target as HTMLElement).closest<HTMLElement>('[data-command]')?.dataset.command
      command && oncommand && oncommand(command)
      clickClose && requestClose()
    }
    node.addEventListener('click', onClick)
    return {
      update(nextClose) {
        requestClose = nextClose
      },
      destroy() {
        node.removeEventListener('click', onClick)
      },
    }
  }
</script>

<Tooltip isDropdown {position} {offset} {trigger}>
  {@render children?.()}
  {#snippet fragment(close)}
    <div use:panelClick={close}>
      {@render dropdown?.(close)}
    </div>
  {/snippet}
</Tooltip>

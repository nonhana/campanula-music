<!--
  弹窗的内容区（外壳是 DialogShell，标题、关闭键、拉手都在外壳里）：滚动的正文和底下一排按钮。
  桌面：正文左右 24px，按钮靠右排在一行（取消在前、确认在后）。手机：确认（贴着底边的弹层）的按钮竖着排、确认在上、撑满一行；
  表单的按钮在标题行里（外壳的 sheetStart / sheetEnd），这里不给 actions。
  确认弹窗（歌单的改为公开、删除，退出登录）都改不回来、或者有代价：取消标了 data-autofocus，打开时焦点落在它上面，误按回车不会直接做。
  这样歌单编辑、退出登录的确认、添加歌曲的桌面排版只有这一份
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import Scrollbar from '../ui/Scrollbar.svelte'

  interface Props {
    /** 在手机的底部弹层里 */
    sheet: boolean
    body: Snippet
    /** 底下一排按钮；手机表单不给 */
    actions?: Snippet
    /** 正文自己管左右内边距（添加歌曲的列表要贴边） */
    flush?: boolean
  }

  const { sheet, body, actions, flush = false }: Props = $props()
</script>

<div class='min-h-0 flex-1 overflow-y-auto overscroll-contain'>
  <Scrollbar />
  <div class={flush
    ? ''
    : sheet
    ? (actions ? 'px-6 pt-2' : 'px-5 pb-6 pt-2')
    : 'px-6 pb-2 pt-2'}>{@render body()}</div>
</div>
{#if actions}
  <div class={sheet ? 'grid flex-none gap-2 px-6 pb-4 pt-6 [&>*:first-child]:order-1' : 'flex flex-none items-center justify-end gap-2 px-6 pb-5 pt-4'}>
    {@render actions()}
  </div>
{/if}

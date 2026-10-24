<!--
  弹窗内容区（外壳 DialogShell 管标题、关闭键、拉手）：滚动正文和底下一排按钮。桌面正文左右 24px、按钮靠右一行；
  手机确认弹层按钮竖排、确认在上，表单的按钮在标题行里（这里不给 actions）。改不回来或有代价的确认，取消标 data-autofocus，
  打开时焦点落在取消上，误按回车不会直接做。歌单编辑、退出登录的确认、添加歌曲的桌面排版只有这一份。
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'

  import Scrollbar from '../ui/Scrollbar.svelte'

  interface Props {
    sheet: boolean
    body: Snippet
    /** 手机表单不给 */
    actions?: Snippet
    /** 添加歌曲的列表要贴边 */
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

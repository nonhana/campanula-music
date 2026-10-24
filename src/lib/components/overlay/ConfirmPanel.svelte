<!--
  确认弹窗的内容（外壳 DialogShell 的 size 是 confirm）：歌单的改为公开、删除（PlaylistEditorPanel）和退出登录（LogoutConfirm）共用。
  正文、取消和确认键，排版是 DialogBody：桌面右下角 取消 / 确认，手机按钮竖着排、确认在上。
  这些都改不回来、或者有代价：打开时焦点落在取消上（data-autofocus），误按回车不会直接做
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import Button from '../ui/Button.svelte'
  import DialogBody from './DialogBody.svelte'

  interface Props {
    /** 在手机的底部弹层里 */
    sheet: boolean
    cancelLabel?: string
    oncancel: () => void
    body: Snippet
    /** 确认键：实心按钮，由调用方给（主按钮或删除用的出错红） */
    confirm: Snippet
  }

  const { sheet, cancelLabel = '取消', oncancel, body, confirm }: Props = $props()
</script>

<DialogBody {sheet} {body}>
  {#snippet actions()}
    <Button variant='outline' onclick={oncancel} data-autofocus>{cancelLabel}</Button>
    {@render confirm()}
  {/snippet}
</DialogBody>

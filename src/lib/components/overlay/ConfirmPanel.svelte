<!-- 确认弹窗（外壳 size 是 confirm）：歌单改为公开、删除和退出登录共用。正文、取消和确认键走 DialogBody；
  改不回来或有代价，打开时焦点落在取消上（data-autofocus），误按回车不会直接做。 -->
<script lang='ts'>
  import type { Snippet } from 'svelte'

  import Button from '../ui/Button.svelte'
  import DialogBody from './DialogBody.svelte'

  interface Props {
    sheet: boolean
    cancelLabel?: string
    oncancel: () => void
    body: Snippet
    /** 实心按钮，由调用方给（主按钮或删除用的出错红） */
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

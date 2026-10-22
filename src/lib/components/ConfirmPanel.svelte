<!--
  确认弹窗里面的排版（外壳是 DialogShell）：歌单的改为公开、删除（PlaylistEditorPanel）和退出登录（LogoutConfirm）共用。
  桌面：标题和关闭键、正文、右下角 取消 / 确认；手机贴着底边的弹层：标题、正文，按钮竖着排，确认在上。
  这些都改不回来、或者有代价：打开时焦点落在取消上（data-autofocus），误按回车不会直接做。
  grip：手机上标题也能按住往下拖收起（外壳给的拖动来源）
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { Attachment } from 'svelte/attachments'
  import { X } from '@lucide/svelte'
  import Button from './ui/Button.svelte'
  import IconButton from './ui/IconButton.svelte'
  import Scrollbar from './ui/Scrollbar.svelte'

  interface Props {
    /** 标题的 id：外壳的 aria-labelledby 指着它 */
    id: string
    title: string
    /** 在手机的底部弹层里 */
    sheet: boolean
    grip?: Attachment<HTMLElement>
    cancelLabel?: string
    /** 忙着时关不掉：取消和关闭键都不能按 */
    busy?: boolean
    oncancel: () => void
    body: Snippet
    /** 确认键：实心按钮，由调用方给（主按钮或删除用的出错红） */
    confirm: Snippet
  }

  const { id, title, sheet, grip, cancelLabel = '取消', busy = false, oncancel, body, confirm }: Props = $props()
</script>

{#snippet cancel()}
  <Button variant='outline' disabled={busy} onclick={oncancel} data-autofocus>{cancelLabel}</Button>
{/snippet}

{#if sheet}
  <div class='px-6 pb-4 pt-2'>
    <h2 {id} class='touch-none text-title-sm text-neutral-900 font-600' {@attach grip}>{title}</h2>
    <div class='mt-2'>{@render body()}</div>
    <div class='grid mt-6 gap-2'>
      {@render confirm()}
      {@render cancel()}
    </div>
  </div>
{:else}
  <div class='flex flex-none items-center gap-3 pb-2 pl-6 pr-4 pt-5'>
    <h2 {id} class='min-w-0 flex-1 text-title-sm text-neutral-900 font-600'>{title}</h2>
    <IconButton icon={X} label='关闭' disabled={busy} onclick={oncancel} />
  </div>
  <div class='min-h-0 flex-1 overflow-y-auto overscroll-contain'>
    <Scrollbar />
    <div class='px-6 pb-2 pt-2'>{@render body()}</div>
  </div>
  <div class='flex flex-none items-center justify-end gap-2 px-6 pb-5 pt-4'>
    {@render cancel()}
    {@render confirm()}
  </div>
{/if}

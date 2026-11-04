<!--
  一键清空下载之前确认（#40）：设置页“已用空间”旁边的“清空”打开，排队中和正在下载的也会停。
  确认键是删除用的出错红，打开时焦点在“取消”上。
-->
<script lang='ts'>
  import ConfirmPanel from '../overlay/ConfirmPanel.svelte'
  import DialogShell from '../overlay/DialogShell.svelte'
  import { getOverlays } from '../overlay/overlay-context'
  import type { DialogRequest } from '../overlay/overlay-requests'
  import { getAppView } from '../shared/app-context.svelte'
  import { formatCount, formatStorageSize } from '../shared/text'
  import Button from '../ui/Button.svelte'

  const view = getAppView()
  const { clearDownloadsConfirm } = getOverlays()
  const downloads = $derived(view.state.downloads)
  const downloaded = $derived(downloads.songs?.length ?? 0)
</script>

<DialogShell layer={clearDownloadsConfirm} title={() => '清空下载？'} size={() => 'confirm'}>
  {#snippet children(_request: DialogRequest, sheet: boolean)}
    <ConfirmPanel {sheet} oncancel={() => clearDownloadsConfirm.close()}>
      {#snippet body()}
        {#if downloaded > 0 || downloads.tasks.size === 0}
          <p class='text-body text-neutral-700 tabular-nums'>{formatCount(downloaded)} 首 · {formatStorageSize(downloads.bytes)}</p>
        {/if}
        {#if downloads.tasks.size > 0}
          <p class={['text-body text-neutral-700', downloaded > 0 && 'mt-2']}>同时取消 {formatCount(downloads.tasks.size)} 首下载</p>
        {/if}
      {/snippet}
      {#snippet confirm()}
        <Button
          variant='destructive'
          onclick={() => {
            void view.app.clearDownloads().catch(error => console.error('清空下载失败', error))
            clearDownloadsConfirm.close()
          }}
        >清空</Button>
      {/snippet}
    </ConfirmPanel>
  {/snippet}
</DialogShell>

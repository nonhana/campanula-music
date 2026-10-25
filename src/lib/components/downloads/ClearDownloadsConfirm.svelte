<!--
  一键清空下载之前确认（#40）：设置页“已用空间”旁边的“清空”打开。删除后要重新下载才能离线听；
  排队中和正在下载的也会停。确认键是删除用的出错红，打开时焦点在“取消”上。
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
  /** 有几首下完的、几首还在排队 / 下载中：只停队列时不要把“0 首下载，腾出 0 MB”念出来 */
  const summary = $derived.by(() => {
    const parts: string[] = []
    const count = downloads.songs?.length ?? 0
    if (count > 0)
      parts.push(`会删掉这台设备上的 ${formatCount(count)} 首下载，腾出 ${formatStorageSize(downloads.bytes)}`)
    if (downloads.tasks.size > 0)
      parts.push(`排队中和正在下载的 ${formatCount(downloads.tasks.size)} 首也会停`)
    return parts.join('；')
  })
</script>

<DialogShell layer={clearDownloadsConfirm} title={() => '清空下载？'} size={() => 'confirm'}>
  {#snippet children(_request: DialogRequest, sheet: boolean)}
    <ConfirmPanel {sheet} oncancel={() => clearDownloadsConfirm.close()}>
      {#snippet body()}
        <p class='text-body text-neutral-700'>
          {summary || '会清空这台设备上的下载'}。清空后要重新下载才能离线听。
        </p>
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

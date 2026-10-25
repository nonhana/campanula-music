<!--
  删除多选里勾选的下载之前确认（#79）：外壳 DialogShell 的 confirm 尺寸、内容 ConfirmPanel，打开时焦点在“取消”上；确认键是删除用的出错红。
  确认后先收起确认和多选，再一次删掉（多选模块的 deleteDownloads）。歌曲菜单里删一首不用确认（DESIGN.md Song Row）。
-->
<script lang='ts'>
  import ConfirmPanel from '../overlay/ConfirmPanel.svelte'
  import DialogShell from '../overlay/DialogShell.svelte'
  import { getOverlays } from '../overlay/overlay-context'
  import type { DeleteDownloadsRequest } from '../overlay/overlay-requests'
  import { formatCount } from '../shared/text'
  import Button from '../ui/Button.svelte'

  const { deleteDownloadsConfirm, multiSelect } = getOverlays()
</script>

<DialogShell layer={deleteDownloadsConfirm} title={({ songs }) => `删除 ${formatCount(songs.length)} 首下载？`} size={() => 'confirm'}>
  {#snippet children(request: DeleteDownloadsRequest, sheet: boolean)}
    <ConfirmPanel {sheet} oncancel={() => deleteDownloadsConfirm.close()}>
      {#snippet body()}
        <p class='text-body text-neutral-700'>删除后要重新下载才能离线听</p>
      {/snippet}
      {#snippet confirm()}
        <Button variant='destructive' onclick={() => void multiSelect.deleteDownloads(request.songs)}>删除</Button>
      {/snippet}
    </ConfirmPanel>
  {/snippet}
</DialogShell>

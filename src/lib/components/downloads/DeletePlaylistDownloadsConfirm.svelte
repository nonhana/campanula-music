<!--
  按歌单删除下载的确认（#40）：从 PlaylistDownloadsDialog 点“删除”打开。只删从这张歌单下载的；
  别的歌单、专辑也下载过，或者单独下载过的，会留着（规则⑦）。确认键是删除用的出错红，打开时焦点在“取消”上。
-->
<script lang='ts'>
  import ConfirmPanel from '../overlay/ConfirmPanel.svelte'
  import DialogShell from '../overlay/DialogShell.svelte'
  import { getOverlays } from '../overlay/overlay-context'
  import type { DeletePlaylistDownloadsRequest } from '../overlay/overlay-requests'
  import { getAppView } from '../shared/app-context.svelte'
  import { formatCount } from '../shared/text'
  import Button from '../ui/Button.svelte'

  const view = getAppView()
  const { deletePlaylistDownloadsConfirm } = getOverlays()
</script>

<DialogShell layer={deletePlaylistDownloadsConfirm} title={request => `删除「${request.name}」的下载？`} size={() => 'confirm'}>
  {#snippet children(request: DeletePlaylistDownloadsRequest, sheet: boolean)}
    <ConfirmPanel {sheet} oncancel={() => deletePlaylistDownloadsConfirm.close()}>
      {#snippet body()}
        <p class='text-body text-neutral-700'>
          会删掉从这张歌单下载的 {formatCount(request.count)} 首；别的歌单、专辑也下载过，或者单独下载过的，会留着。删除后要重新下载才能离线听。
        </p>
      {/snippet}
      {#snippet confirm()}
        <Button
          variant='destructive'
          onclick={() => {
            void view.app.deletePlaylistDownloads(request.playlistId).catch(error => console.error('按歌单删除下载失败', error))
            deletePlaylistDownloadsConfirm.close()
          }}
        >删除</Button>
      {/snippet}
    </ConfirmPanel>
  {/snippet}
</DialogShell>

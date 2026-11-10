<script lang="ts">
  import ConfirmPanel from '../overlay/ConfirmPanel.svelte';
  import DialogShell from '../overlay/DialogShell.svelte';
  import { getOverlays } from '../overlay/overlay-context';
  import type { DeletePlaylistDownloadsRequest } from '../overlay/overlay-requests';
  import { getAppView } from '../shared/app-context.svelte';
  import Button from '../ui/Button.svelte';

  const view = getAppView();
  const { deletePlaylistDownloadsConfirm } = getOverlays();
</script>

<DialogShell
  layer={deletePlaylistDownloadsConfirm}
  title={(request) => `删除「${request.name}」的下载？`}
  size={() => 'confirm'}
>
  {#snippet children(request: DeletePlaylistDownloadsRequest, sheet: boolean)}
    <ConfirmPanel
      {sheet}
      oncancel={() => deletePlaylistDownloadsConfirm.close()}
    >
      {#snippet body()}
        <p class="text-body text-neutral-700">
          仅删除此歌单独有的下载，其他来源的下载保留
        </p>
      {/snippet}
      {#snippet confirm()}
        <Button
          variant="destructive"
          onclick={() => {
            void view.app
              .deletePlaylistDownloads(request.playlistId)
              .catch((error) => console.error('按歌单删除下载失败', error));
            deletePlaylistDownloadsConfirm.close();
          }}>删除</Button
        >
      {/snippet}
    </ConfirmPanel>
  {/snippet}
</DialogShell>

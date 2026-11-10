<script lang="ts">
  import ConfirmPanel from '../overlay/ConfirmPanel.svelte';
  import DialogShell from '../overlay/DialogShell.svelte';
  import { getOverlays } from '../overlay/overlay-context';
  import type { DeleteDownloadsRequest } from '../overlay/overlay-requests';
  import { formatCount } from '../shared/text';
  import Button from '../ui/Button.svelte';

  const { deleteDownloadsConfirm, multiSelect } = getOverlays();
</script>

<DialogShell
  layer={deleteDownloadsConfirm}
  title={({ songs }) => `删除 ${formatCount(songs.length)} 首下载？`}
  size={() => 'confirm'}
>
  {#snippet children(request: DeleteDownloadsRequest, sheet: boolean)}
    <ConfirmPanel {sheet} oncancel={() => deleteDownloadsConfirm.close()}>
      {#snippet confirm()}
        <Button
          variant="destructive"
          onclick={() => void multiSelect.deleteDownloads(request.songs)}
          >删除</Button
        >
      {/snippet}
    </ConfirmPanel>
  {/snippet}
</DialogShell>

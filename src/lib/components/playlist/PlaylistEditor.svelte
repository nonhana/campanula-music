<script lang="ts">
  import type { Snippet } from 'svelte';

  import type { DialogSize } from '../overlay/DialogShell.svelte';
  import DialogShell from '../overlay/DialogShell.svelte';
  import { getOverlays } from '../overlay/overlay-context';
  import type { EditorRequest } from '../overlay/overlay-requests';
  import PlaylistEditorPanel from './PlaylistEditorPanel.svelte';

  const { playlistEditor } = getOverlays();

  const TITLES = {
    new: '新建歌单',
    info: '编辑歌单信息',
    public: '改为公开歌单',
    delete: '删除歌单',
  } as const;
  const SIZES: Record<EditorRequest['mode'], DialogSize> = {
    new: 'form',
    info: 'wide',
    public: 'confirm',
    delete: 'confirm',
  };
</script>

<DialogShell
  layer={playlistEditor}
  title={(request) => TITLES[request.mode]}
  size={(request) => SIZES[request.mode]}
>
  {#snippet children(
    request: EditorRequest,
    sheet: boolean,
    heading: Snippet<[classes: string]>,
  )}
    <PlaylistEditorPanel {request} {sheet} {heading} />
  {/snippet}
</DialogShell>
